"""Bake the fitted tee for the WebGL configurator with Blender 4.5.

blender -b -t 6 --python tools/prepare-tee.py -- TSHIRT.glb BODY.glb src/js/models/tee.im3d

CC0 neutral garment and avatar at:
https://github.com/kblood/CharacterCreator/blob/master/output/clothing_tshirt.glb
https://github.com/kblood/CharacterCreator/blob/master/output/base_body.glb
https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md
The avatar participates in the offline simulation and is excluded from export.
"""

import argparse
from io import BytesIO
from collections import defaultdict
import math
from pathlib import Path
import struct
import sys
import zlib

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform


ASSEMBLY_SCALE = 1.071
HEM_HEIGHT = -.34


def clamp(value, low=0., high=1.):
    return min(high, max(low, value))


def smoothstep(start, end, value):
    t = clamp((value - start) / (end - start))
    return t * t * (3 - 2 * t)


def select(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def import_mesh(path, name):
    previous = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    added = set(bpy.data.objects) - previous
    obj = next(x for x in added if x.type == 'MESH' and x.name.startswith(name))
    placement = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = placement
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    for item in added - {obj}:
        bpy.data.objects.remove(item, do_unlink=True)
    select(obj)
    # The source sets every morph's default weight to one for its generator.
    # Use the shared neutral rest shape for the garment and collision form.
    if obj.data.shape_keys:
        obj.shape_key_clear()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def clean_mesh(obj, *, panels=False):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if panels:
        original_uv = bm.loops.layers.uv.active
        for face in bm.faces:
            u = sum(loop[original_uv].uv.x for loop in face.loops) / len(face.loops)
            face.material_index = 2 if u > .74 else int(u < .4)
        bmesh.ops.join_triangles(
            bm, faces=list(bm.faces), cmp_materials=True, cmp_uvs=True,
            angle_face_threshold=0.7, angle_shape_threshold=1.0,
        )
    else:
        remove = [v for v in bm.verts if not .72 <= v.co.z <= 1.58]
        bmesh.ops.delete(bm, geom=remove, context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000015)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    for face in bm.faces:
        face.smooth = True
    bm.to_mesh(obj.data)
    bm.free()


def subdivide(obj, name):
    select(obj)
    sub = obj.modifiers.new(name, 'SUBSURF')
    sub.levels = 1
    sub.boundary_smooth = 'PRESERVE_CORNERS'
    sub.uv_smooth = 'PRESERVE_BOUNDARIES'
    bpy.ops.object.modifier_apply(modifier=sub.name)


def relaxed_arm(point):
    # The fit form's neutral upper and lower arm bind points, in metres.
    side = math.copysign(1., point.x)
    shoulder = Vector((side * .170, -.019, 1.320))
    old_elbow = Vector((side * .331, -.020, 1.140))
    old_wrist = Vector((side * .453, -.183, 1.016))
    elbow = Vector((side * (.244 + .005 * side), -.036 - .010 * side, 1.091))
    wrist = Vector((side * (.246 + .007 * side), -.083 - .012 * side, .884))
    upper = old_elbow - shoulder
    forearm = old_wrist - old_elbow
    first = shoulder + upper.rotation_difference(elbow - shoulder) @ (point - shoulder)
    second = elbow + forearm.rotation_difference(wrist - elbow) @ (point - old_elbow)
    bend = smoothstep(-.053, .065, (point - old_elbow).dot(upper.normalized()))
    weight = smoothstep(.155, .252, abs(point.x))
    return point.lerp(first.lerp(second, bend), weight)


def fit_ease(tee, body, kind):
    # Both pieces start on the same measured fitting form. Retain room under
    # the arm and through the waist before settling the cloth under gravity.
    for vertex in body.data.vertices:
        p = vertex.co.lerp(relaxed_arm(vertex.co), .67) if kind != 'tank' else vertex.co.copy()
        easing = .966 + .017 * smoothstep(1.10, 1.32, p.z)
        p.x *= easing
        p.y = -.025 + (p.y + .025) * easing
        vertex.co = p
    for vertex in tee.data.vertices:
        p = vertex.co.copy()
        side = math.copysign(1., p.x)
        if kind != 'tank':
            shoulder = Vector((side * .170, -.019, 1.320))
            upper = Vector((side * .67, -.04, -.73))
            along = (p - shoulder).dot(upper)
            sleeve = smoothstep(.028, .112, along) * smoothstep(.167, .220, abs(p.x))
            # Carry the cut cuff farther down the relaxed upper arm.
            p = p.lerp(relaxed_arm(p), .67)
            p += Vector((side * .011, -.006, -.032 - .007 * side)) * sleeve
            p.y += sleeve * (p.y + .027) * -.075
        waist = (1. - smoothstep(1.055, 1.25, p.z)) * smoothstep(.881, .97, p.z)
        p.x += waist * .008 * (abs(p.x) / .18) ** 1.2 * side
        p.y += waist * (p.y + .022) * .075
        hem = 1. - smoothstep(.879, .952, p.z)
        p.z += hem * (.008 * p.x / .19 + .004 * (p.y + .025))
        if kind == 'tank':
            shoulder = smoothstep(1.289, 1.37, p.z) * smoothstep(.080, .16, abs(p.x))
            p.x -= side * .028 * shoulder
            scoop = smoothstep(1.337, 1.400, p.z) * math.exp(-(p.x / .060)**2)
            face = smoothstep(-.014, .052, -p.y)
            p.z -= scoop * (.012 + .037 * face)
            p.x += side * .012 * smoothstep(1.36, 1.414, p.z) * math.exp(-((abs(p.x) - .052) / .028)**2)
        vertex.co = p
    tee.data.update()
    body.data.update()


def cut_sleeves(tee):
    bm = bmesh.new()
    bm.from_mesh(tee.data)
    sleeves = [face for face in bm.faces if face.material_index == 2]
    bmesh.ops.delete(bm, geom=sleeves, context='FACES')
    bm.to_mesh(tee.data)
    bm.free()


def sculpt_drape(tee, kind):
    # Fold placement follows the hip support and the sleeve-to-body joins in
    # the catalogue fit. Each entry is an off-centre cloth ridge in metres.
    # A shallow opposing trough lets the fabric turn back onto the form.
    front = (
        (-.172, .974, -.55, .100, .020, .0095),
        (-.170, 1.059, -.57, .109, .017, .0079),
        (-.177, 1.166, -.95, .095, .027, .0118),
        ( .165, .934, .22, .128, .015, .0078),
        ( .178, 1.030, .49, .079, .026, .0096),
        ( .181, 1.169, .94, .061, .021, .0068),
    )
    back = (
        (-.163, .944, -.40, .129, .018, .0089),
        (-.170, 1.058, -.66, .089, .021, .0072),
        ( .171, 1.014, .72, .100, .020, .0108),
        ( .161, 1.156, .55, .082, .029, .0063),
    )
    shape = []
    for vertex in tee.data.vertices:
        p = vertex.co.copy()
        x, y, z = p
        n = vertex.normal.normalized()
        pressure = 0.
        for folds, side in ((front, -1), (back, 1)):
            envelope = smoothstep(-.13, .51, side * n.y)
            for across, height, slope, span, width, rise in folds:
                dx = x - across
                # Spread the compression as the fold reaches the front panel.
                dy = z - height - slope * dx - math.copysign(1., across) * 1.1 * dx * dx
                carry = math.exp(-(dx / span)**2)
                ridge = math.exp(-(dy / width)**2)
                trough = math.exp(-((dy + width * 1.15) / (width * .84))**2)
                pressure += envelope * carry * rise * (ridge - .51 * trough)
        if kind != 'tank':
            # Compression just below the set-in seam. The two sleeves carry
            # unequal folds because the arms are supported at different angles.
            outside = smoothstep(.159, .225, abs(x))
            crease = z - (1.242 + .018 * x) - .63 * (abs(x) - .195)
            arm = (math.exp(-(crease / .015)**2) - .72 * math.exp(-((crease + .016) / .014)**2))
            pressure += outside * (.0043 if x > 0 else .0061) * arm
        shape.append(p + n * pressure)
    for vertex, position in zip(tee.data.vertices, shape):
        vertex.co = position
    tee.data.update()


def finish_openings(tee, kind):
    # Compress one quadrant of each free cuff and relax the other. The
    # adjustment tapers into the sewn sleeve, leaving its cap intact.
    if kind != 'tank':
        mesh = tee.data
        for path in edge_loops(mesh):
            edge = [mesh.vertices[i].co.copy() for i in path]
            center = sum(edge, Vector()) / len(edge)
            if abs(center.x) < .137 or center.z < 1.09:
                continue
            side = math.copysign(1., center.x)
            for vertex in mesh.vertices:
                p = vertex.co
                if side * p.x < .162 or abs(p.z - center.z) > .10:
                    continue
                distance = min((p - point).length for point in edge)
                weight = 1. - smoothstep(.001, .029, distance)
                front = smoothstep(-.024, .027, center.y - p.y)
                under = smoothstep(-.012, .030, center.z - p.z)
                crease = weight * front * under
                p.z += .011 * crease
                p.y += .010 * crease
                p.x -= .0065 * side * crease
                p.z -= weight * (1. - front) * .0026
    if kind == 'kit':
        # Tuck after settling so the waistband cannot change the shoulder
        # and chest of the exact same shirt through collision with the form.
        for vertex in tee.data.vertices:
            p = vertex.co
            tuck = 1. - smoothstep(.925, .969, p.z)
            p.x *= 1. - .166 * tuck
            p.y = -.026 + (p.y + .026) * (1. - .245 * tuck)
    tee.data.update()


def add_print_uv(obj):
    # Original pattern-panel UVs provide an undeformed, metrically stable cut.
    source = obj.data.uv_layers.active
    target = obj.data.uv_layers.new(name='Print', do_init=False)
    for face in obj.data.polygons:
        for index in face.loop_indices:
            loop = obj.data.loops[index]
            p = obj.data.vertices[loop.vertex_index].co
            original = source.data[index].uv
            if face.material_index == 2:
                # Sleeve fills from cap to turned opening, with an underarm seam.
                edge = smoothstep(.17, .285, abs(p.x))
                v = clamp((1. - edge) * .78 + (p.z - 1.22) * 2.1)
                atlas_v = 1. - original.y - (.3698 if p.x < 0 else 0.)
                u = clamp((atlas_v - .288) / .278)
            else:
                center, half_width, layout = ((.577, .140, .25) if face.material_index == 0
                                              else (.184, .165, .75))
                u = layout + clamp((original.x - center) / half_width, -1., 1.) * .25
                y = HEM_HEIGHT + (p.z - .881) * ASSEMBLY_SCALE
                v = clamp(.8 * (y - HEM_HEIGHT) / .505)
            target.data[index].uv = (u, v)
    obj.data.uv_layers.active = target


def drape(tee, body, frame, *, pin=None, limit=.027, heavy=False):
    select(body)
    collision = body.modifiers.new('Invisible fitting form', 'COLLISION')
    collision.settings.thickness_outer = .0028
    collision.settings.cloth_friction = 4.
    select(tee)
    pins = tee.vertex_groups.new(name='Shoulder support')
    rest = [vertex.co.copy() for vertex in tee.data.vertices]
    edges = [tee.data.vertices[index].co.copy()
             for path in edge_loops(tee.data) for index in path]
    for vertex in tee.data.vertices:
        x, _, z = vertex.co
        at_neck = 1. - smoothstep(.083, .170, abs(x))
        at_shoulder = 1. - smoothstep(.130, .224, abs(x))
        weight = max(smoothstep(1.379, 1.416, z) * at_neck,
                     smoothstep(1.325, 1.39, z) * at_shoulder * .65)
        if z > 1.38 and abs(x) < .088:
            weight = 1.
        if pin is not None:
            weight = pin(vertex.co)
        if weight > .02:
            pins.add([vertex.index], weight, 'REPLACE')
    cloth = tee.modifiers.new('Settled cotton jersey', 'CLOTH')
    settings = cloth.settings
    settings.vertex_group_mass = pins.name
    settings.quality = 9
    settings.mass = .34 if heavy else .22
    settings.air_damping = 1.5
    settings.tension_stiffness = 19.
    settings.compression_stiffness = 18.
    settings.shear_stiffness = 10.
    settings.bending_stiffness = .27 if heavy else .135
    settings.tension_damping = 5.
    settings.compression_damping = 5.
    settings.shear_damping = 4.
    settings.bending_damping = .55
    cloth.collision_settings.distance_min = .0028
    cloth.collision_settings.collision_quality = 4
    cloth.collision_settings.use_self_collision = True
    cloth.collision_settings.self_distance_min = .0022
    cloth.point_cache.frame_end = frame
    scene = bpy.context.scene
    for i in range(1, frame + 1):
        scene.frame_set(i)
        graph = bpy.context.evaluated_depsgraph_get()
        graph.update()
        if i % 5 == 0:
            print(f'Cloth frame {i}', flush=True)
    evaluated = tee.evaluated_get(bpy.context.evaluated_depsgraph_get())
    simulated = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True,
                                                depsgraph=bpy.context.evaluated_depsgraph_get())
    tee.modifiers.remove(cloth)
    tee.data = simulated
    for vertex, original in zip(tee.data.vertices, rest):
        edge_distance = min((original - edge).length for edge in edges)
        drape_weight = .12 + .68 * smoothstep(.004, .048, edge_distance)
        chest = (1. - smoothstep(.045, .14, abs(original.x))) * smoothstep(1.13, 1.29, original.z)
        drape_weight *= 1. - .64 * chest
        delta = vertex.co - original
        if delta.length > limit:
            delta = delta.normalized() * limit
        vertex.co = original + drape_weight * delta
    tee.data.update()
    bpy.data.objects.remove(body, do_unlink=True)


def edge_loops(mesh):
    segments = defaultdict(list)
    for face in mesh.polygons:
        for a, b in zip(face.vertices, list(face.vertices[1:]) + [face.vertices[0]]):
            segments[tuple(sorted((a, b)))].append((a, b))
    follow = {a: b for uses in segments.values() if len(uses) == 1 for a, b in uses}
    while follow:
        start = next(iter(follow))
        path = [start]
        while follow[path[-1]] != start:
            path.append(follow.pop(path[-1]))
        follow.pop(path[-1])
        yield path


class Buffer:
    def __init__(self, name):
        self.name = name
        self.vertices = []
        self.indices = []
        self.cache = {}

    def vertex(self, coord, normal, uv, ambient=1.):
        entry = (*coord, *normal, *uv, ambient)
        if entry not in self.cache:
            self.cache[entry] = len(self.vertices)
            self.vertices.append(entry)
        return self.cache[entry]

    def write(self, stream):
        stream.write(struct.pack('<II', len(self.vertices), len(self.indices)))
        for x, y, z, nx, ny, nz, u, v, ambient in self.vertices:
            # Blender is Z-up and looks toward the front from -Y.
            stream.write(struct.pack('<hhhbbbBHH',
                                     round(x * ASSEMBLY_SCALE * 16000),
                                     round((z - .881) * ASSEMBLY_SCALE * 16000 + HEM_HEIGHT * 16000),
                                     round((-y - .025) * ASSEMBLY_SCALE * 16000),
                                     round(nx * 127), round(nz * 127), round(-ny * 127),
                                     round(clamp(ambient) * 255),
                                     round(clamp(u) * 65535), round(clamp(v) * 65535)))
        stream.write(struct.pack(f'<{len(self.indices)}H', *self.indices))
        print(f'{self.name}: {len(self.vertices):,} vertices, {len(self.indices)//3:,} triangles')


def make_band(mesh, path, layers, target, surface, edge_uvs=None):
    # Profile is measured from the cut edge, in the tangent and normal directions.
    length = 0.
    rows = []
    for i, index in enumerate(path + [path[0]]):
        vertex = mesh.vertices[index]
        p = vertex.co
        n = vertex.normal.normalized()
        prev = mesh.vertices[path[(i - 1) % len(path)]].co
        next_p = mesh.vertices[path[(i + 1) % len(path)]].co
        tangent = (next_p - prev).normalized()
        outward = tangent.cross(n).normalized()
        if i:
            length += (p - prev).length
        row = []
        for offset, depth, out_n, tan_n, v, ambient in layers:
            base = p + outward * offset
            if offset < 0.:
                # Seat the seam allowance on the actual cloth instead of a
                # tangent extrapolation that floats off a tightly curved edge.
                base = surface.find_nearest(base, abs(offset) + .004)[0] or base
            normal = (n * out_n + outward * tan_n).normalized()
            row.append((base + n * depth, normal, (length / .62, v), ambient, offset))
        rows.append(row)
    for index, (a, b) in enumerate(zip(rows, rows[1:])):
        if edge_uvs:
            uva, uvb = edge_uvs[index]
            a = [(p, n, (uva[0], uva[1] - offset * 1.70), ao, offset) for p, n, _, ao, offset in a]
            b = [(p, n, (uvb[0], uvb[1] - offset * 1.70), ao, offset) for p, n, _, ao, offset in b]
        av = [target.vertex(*point[:4]) for point in a]
        bv = [target.vertex(*point[:4]) for point in b]
        for i in range(len(layers) - 1):
            target.indices.extend((av[i], av[i+1], bv[i+1], av[i], bv[i+1], bv[i]))


def bake_occlusion(mesh, tree):
    # Diffuse cloth contact is baked separately from the customizable canvas.
    samples = 16
    result = []
    for vertex in mesh.vertices:
        n = vertex.normal.normalized()
        tangent = n.orthogonal().normalized()
        across = n.cross(tangent)
        origin = vertex.co + n * .0016
        occluded = 0.
        for i in range(samples):
            cos_theta = math.sqrt((i + .5) / samples)
            r = math.sqrt(1. - cos_theta * cos_theta)
            angle = 2.39996323 * i
            ray = n * cos_theta + r * (tangent * math.cos(angle) + across * math.sin(angle))
            hit = tree.ray_cast(origin, ray, .080)[3]
            if hit is not None:
                occluded += 1. - hit / .080
        result.append(1. - .54 * occluded / samples)
    return result


def export(tee, output, kind):
    mesh = tee.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers['Print']
    body, sleeve, trim, thread_body, thread_sleeve = [
        Buffer(label) for label in
        ('Body', 'Sleeves', 'Collar and cuff rib', 'Body seams', 'Sleeve seams')
    ]
    edge_panels = defaultdict(dict)
    for polygon in mesh.polygons:
        loops = list(polygon.loop_indices)
        for a, b in zip(loops, loops[1:] + loops[:1]):
            va, vb = (mesh.loops[index].vertex_index for index in (a, b))
            start, end = tuple(uv.data[a].uv), tuple(uv.data[b].uv)
            pair = (start, end) if va < vb else (end, start)
            edge_panels[tuple(sorted((va, vb)))][polygon.material_index] = pair

    coords = [vertex.co for vertex in mesh.vertices]
    triangles = list(mesh.loop_triangles)
    surface = BVHTree.FromPolygons(coords, [triangle.vertices for triangle in triangles],
                                  all_triangles=True)
    occlusion = bake_occlusion(mesh, surface)

    def sample_print(position, triangle_index):
        triangle = triangles[triangle_index]
        corners = [coords[index] for index in triangle.vertices]
        sample = [Vector((*uv.data[index].uv, 0.)) for index in triangle.loops]
        return barycentric_transform(position, *corners, *sample).xy
    for triangle in mesh.loop_triangles:
        sleeve_panel = mesh.polygons[triangle.polygon_index].material_index == 2
        shell = sleeve if sleeve_panel else body
        for loop in triangle.loops:
            vertex = mesh.vertices[mesh.loops[loop].vertex_index]
            n = vertex.normal.normalized()
            tex = tuple(uv.data[loop].uv)
            shell.indices.append(shell.vertex(vertex.co, n, tex, occlusion[vertex.index]))
    collar = [
        (-.013, .0010, 1, -.4, 0., .92),
        (-.009, .0021, 1, -.2, .16, 1.),
        ( .0007, .0022, 1, 0, .70, 1.),
        ( .0016, .0010, .65, .75, .81, .94),
        ( .0016,-.0009, -.65, .75, .90, .81),
        ( .0006, -.0024, -1, .05, 1., .69),
        (-.012, -.0016, -1, -.22, .20, .68),
    ]
    hem = [
        (-.0115, .00019, 1, -.18, 0., .94),
        (-.0098, .00115, 1, -.10, .24, 1.),
        (-.0010, .00102, 1, .12, .50, .97),
        ( .0003, .00015, .55, .83, .62, .89),
        ( 0., -.0015, -.60, .78, .85, .76),
        (-.0032, -.0018, -1, .02, 1., .72),
    ]
    cuff = [
        (-.0098, .00085, 1, -.16, 0., .94),
        (-.0076, .00165, 1, -.1, .16, 1.),
        (-.0010, .00145, 1, .12, .68, 1.),
        ( .0004, .00065, .55, .83, .80, .90),
        ( .0002, -.0015, -.60, .78, 1., .75),
        (-.0021, -.0021, -1, .02, .25, .70),
    ]
    for path in edge_loops(mesh):
        average = sum((mesh.vertices[index].co for index in path), Vector()) / len(path)
        if average.z > 1.33 and abs(average.x) < .095:
            make_band(mesh, path, collar, trim, surface)
            stitch_edge(mesh, path, thread_body, surface, sample_print, offsets=(.015,))
        elif average.z > 1.10:
            make_band(mesh, path, collar if kind == 'tank' else cuff, trim, surface)
            stitch_edge(mesh, path, thread_body if kind == 'tank' else thread_sleeve, surface, sample_print, offsets=(.0107, .0136))
        else:
            colors = []
            for a, b in zip(path, path[1:] + path[:1]):
                pair = next(iter(edge_panels[tuple(sorted((a, b)))].values()))
                colors.append(pair if a < b else pair[::-1])
            make_band(mesh, path, hem, body, surface, colors)
            stitch_edge(mesh, path, thread_body, surface, sample_print, offsets=(.0126, .0152))

    # A fine raised seam lies just inside the set-in sleeve and torso side join.
    for (a, b), panels in edge_panels.items():
        if len(panels) != 2:
            continue
        target = thread_sleeve if 2 in panels else thread_body
        if target == thread_body and min(mesh.vertices[i].co.z for i in (a,b)) > 1.30:
            continue
        make_seam_segment(mesh, a, b, panels[2] if 2 in panels else panels[0], target)

    buffers = [body, sleeve, trim, thread_body, thread_sleeve]
    with BytesIO() as stream:
        stream.write(b'IT02')
        for part in buffers:
            part.write(stream)
        output.write_bytes(zlib.compress(stream.getvalue(), level=9))
    print(f'{output.stat().st_size:,} bytes compressed')


def make_seam_segment(mesh, a, b, uv, target):
    start, end = (mesh.vertices[index] for index in (a, b))
    stitch_segment(start.co, end.co, start.normal, end.normal, uv, target, .00045)


def stitch_edge(mesh, path, target, surface, sample_print, offsets):
    for row in offsets:
        points = []
        for i, index in enumerate(path):
            v = mesh.vertices[index]
            before = mesh.vertices[path[i - 1]].co
            after = mesh.vertices[path[(i + 1) % len(path)]].co
            inset = v.normal.cross(after - before).normalized()
            p, n, face, _ = surface.find_nearest(v.co + inset * row, row + .004)
            if p is None:
                p, n, face, _ = surface.find_nearest(v.co)
            points.append((p, n, sample_print(p, face)))
        for (start, n0, uv0), (end, n1, uv1) in zip(points, points[1:] + points[:1]):
            if abs(uv0[0] - uv1[0]) > .38:
                # Keep the short needle segment on its own print island.
                uv1 = uv0
            stitch_segment(start, end, n0, n1, (uv0, uv1), target, .00038)


def stitch_segment(start, end, normal0, normal1, uv, target, lift):
    delta = end - start
    tangent = delta.normalized()
    count = max(1, math.floor(delta.length / .0032 + .5))
    for i in range(count):
        row = []
        for fraction in ((i + .09) / count, (i + .78) / count):
            n = normal0.lerp(normal1, fraction).normalized()
            p = start.lerp(end, fraction) + n * lift
            width = n.cross(tangent) * .00022
            tex = tuple(Vector(uv[0]).lerp(Vector(uv[1]), fraction))
            row.extend((target.vertex(p - width, n, tex, .73),
                        target.vertex(p + width, n, tex, .73)))
        target.indices.extend((row[0], row[2], row[1], row[2], row[3], row[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tee', type=Path)
    parser.add_argument('body', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--frame', type=int, default=18)
    parser.add_argument('--kind', choices=('tee', 'kit', 'tank'), default='tee')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tee = import_mesh(args.tee, 'Cloth_tshirt')
    body = import_mesh(args.body, 'Body')
    for label in ('Back', 'Sleeves'):
        tee.data.materials.append(bpy.data.materials.new(label))
    clean_mesh(tee, panels=True)
    clean_mesh(body)
    if args.kind == 'tank':
        cut_sleeves(tee)
    subdivide(tee, 'Pattern panels')
    add_print_uv(tee)
    fit_ease(tee, body, args.kind)
    if args.frame > 1:
        drape(tee, body, args.frame, limit=.019)
    subdivide(tee, 'Drape refinement')
    sculpt_drape(tee, args.kind)
    finish_openings(tee, args.kind)
    export(tee, args.output, args.kind)


if __name__ == '__main__':
    main()
