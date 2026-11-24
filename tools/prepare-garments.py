"""Fit the zip hoodie and sports shorts to the neutral Blender avatar.

blender -b --python tools/prepare-garments.py -- hoodie HOODIE.glb BODY.glb hoodie.im3d
blender -b --python tools/prepare-garments.py -- shorts SHORTS.glb BODY.glb shorts.im3d

The source meshes and avatar are CC0 CharacterCreator exports.
https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md
"""
import argparse
from collections import defaultdict
from heapq import heappop, heappush
from importlib.util import module_from_spec, spec_from_file_location
from io import BytesIO
import math
from pathlib import Path
import sys
import zlib

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

sys.dont_write_bytecode = True
spec = spec_from_file_location('fit', Path(__file__).with_name('prepare-tee.py'))
fit = module_from_spec(spec)
spec.loader.exec_module(fit)
Buffer, clamp, smoothstep = fit.Buffer, fit.clamp, fit.smoothstep


def clean(obj, panel, minimum=None):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if minimum is None:
        uv = bm.loops.layers.uv.active
        for face in bm.faces:
            centre = sum((loop[uv].uv for loop in face.loops), Vector((0., 0.))) / len(face.loops)
            face.material_index = panel(centre)
        bmesh.ops.join_triangles(bm, faces=list(bm.faces), cmp_materials=True, cmp_uvs=True,
                                angle_face_threshold=.7, angle_shape_threshold=1.)
    else:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not minimum[0] <= v.co.z <= minimum[1]],
                         context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000014)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    for face in bm.faces:
        face.smooth = True
    bm.to_mesh(obj.data)
    bm.free()


def hoodie_panel(uv):
    if 1. - uv.y > .435 and uv.x < .732:
        return 3
    if uv.x > .71:
        return 2
    return int(uv.x < .39)


def add_uv(obj, kind):
    source = obj.data.uv_layers.active
    uv = obj.data.uv_layers.new(name='Print', do_init=False)
    for face in obj.data.polygons:
        panel = face.material_index
        for i in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[i].vertex_index].co
            old = source.data[i].uv
            if kind == 'shorts':
                # Number position and the stripe are referenced to the front
                # and side seams of each original shorts pattern panel.
                side = 1 if panel == 0 else -1
                ycentre = -.018 - .007 * side
                theta = math.atan2(p.x - side * .098, -(p.y - ycentre))
                u = (.25 + theta / math.tau) % 1.
                v = clamp((p.z - .5639) / .385) * .83
            elif panel < 2:
                centre, width, u0 = (.5605, .142, .25) if panel == 0 else (.1696, .160, .75)
                u = u0 + clamp((old.x - centre) / width, -1, 1) * .25
                v = clamp((p.z - .834) * fit.ASSEMBLY_SCALE * .8 / .505)
            elif panel == 2:
                lo, hi = (.0828, .4089) if p.x > 0. else (.6364, .9603)
                u = clamp((1. - old.y - lo) / (hi - lo))
                v = 1. - smoothstep(.16, .49, abs(p.x))
            else:
                u = clamp((old.x - .0229) / .70)
                v = clamp((old.y - .299) / .252)
            uv.data[i].uv = u, v
        if kind == 'shorts':
            # Keep the UV seam on the leg interior and out of the number.
            values = [uv.data[i].uv.x for i in face.loop_indices]
            if max(values) - min(values) > .5:
                for i in face.loop_indices:
                    if uv.data[i].uv.x < .5:
                        uv.data[i].uv.x = 1.
    obj.data.uv_layers.active = uv


def remove_original_hood(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == 3], context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def pose_hoodie_arms(obj, *, garment):
    # Pose both the panels and the collision form with their original skin
    # weights. An armhole point keeps the portion bound to the rib cage.
    groups = {group.name: group.index for group in obj.vertex_groups}
    arms = {}
    for side, suffix in ((1, 'l'), (-1, 'r')):
        shoulder = Vector((side * .170, -.019, 1.320))
        elbow = Vector((side * .331, -.020, 1.140))
        wrist = Vector((side * .453, -.183, 1.016))
        posed_elbow = Vector((side * (.258 + side * .006), -.026 - side * .012, 1.099 + side * .009))
        posed_wrist = Vector((side * (.274 + side * .012), -.097 - side * .016, .878 + side * .011))
        upper_axis, lower_axis = elbow - shoulder, wrist - elbow
        arms[side] = (
            tuple(groups[name + '_' + suffix] for name in ('upperarm', 'lowerarm', 'hand')),
            shoulder, elbow, posed_elbow,
            upper_axis.rotation_difference(posed_elbow - shoulder),
            lower_axis.rotation_difference(posed_wrist - posed_elbow),
            upper_axis.normalized(), lower_axis.normalized(),
        )
    for vertex in obj.data.vertices:
        p = vertex.co.copy()
        side = 1 if p.x > 0 else -1
        indices, shoulder, elbow, target, rotate_upper, rotate_lower, upper, lower = arms[side]
        weights = {group.group: group.weight for group in vertex.groups}
        w_upper, w_lower, w_hand = (weights.get(index, 0.) for index in indices)
        w_lower += w_hand
        along = (p - elbow).dot(lower)
        if garment:
            # Full biceps and forearms, narrowing into a short rib cuff.
            guide = elbow + lower * along
            lower_ease = .12 - .25 * smoothstep(.138, .226, along)
            forearm = p + (p - guide) * lower_ease
            up_distance = (p - shoulder).dot(upper)
            upper_guide = shoulder + upper * up_distance
            arm = p + (p - upper_guide) * (.10 * smoothstep(.022, .107, up_distance))
        else:
            arm, forearm = p, p
        posed = p * max(0., 1. - w_upper - w_lower)
        posed += (shoulder + rotate_upper @ (arm - shoulder)) * w_upper
        posed += (target + rotate_lower @ (forearm - elbow)) * w_lower
        if garment:
            underarm = math.exp(-((p.z - 1.238) / .072)**2)
            waist = math.exp(-((p.z - 1.004) / .115)**2)
            torso = 1. - clamp((w_upper + w_lower) * 1.65)
            posed.x += side * torso * (.0115 * waist + .009 * underarm) * smoothstep(.08, .175, abs(p.x))
            posed.y += torso * (.030 + .045 * waist) * (p.y + .025)
            hem = 1. - smoothstep(.832, .911, posed.z)
            posed.x *= 1. - .046 * hem
            posed.y = -.023 + (posed.y + .023) * (1. - .070 * hem)
            posed.z += torso * hem * (.006 * p.x / .18)
        else:
            posed.x *= .966
            posed.y = -.025 + (posed.y + .025) * .973
        vertex.co = posed
    obj.data.update()


def prepare_shorts(obj):
    for vertex in obj.data.vertices:
        p = vertex.co
        side = math.copysign(1., p.x)
        leg = 1. - smoothstep(.568, .825, p.z)
        waist = smoothstep(.879, .942, p.z)
        p.x += (p.x - side * .104) * .195 * leg + side * waist * .009
        p.y += (p.y + .020) * (.095 * leg + .048 * waist)
        p.z += leg * (.011 + .008 * side + .052 * (p.x - side * .116))
        # Bias the elastic casing onto one common-height torso fitting form.
        p.z += .009 * waist
        crotch = math.exp(-(p.x / .055)**2 - ((p.z - .751) / .065)**2)
        p.z -= .009 * crotch
    obj.data.update()


def sculpt(mesh, kind):
    if kind == 'shorts':
        # Remove a sharp compressed triangle at the fly without flattening
        # the saddle seam and the division between the two legs.
        neighbors = defaultdict(set)
        for edge in mesh.edges:
            a, b = edge.vertices
            neighbors[a].add(b)
            neighbors[b].add(a)
        for _ in range(2):
            points = []
            for vertex in mesh.vertices:
                p = vertex.co
                weight = .45 * math.exp(-(p.x / .080)**2 - ((p.z - .755) / .063)**2)
                if p.y < -.03 and neighbors[vertex.index]:
                    mean = sum((mesh.vertices[i].co for i in neighbors[vertex.index]), Vector()) / len(neighbors[vertex.index])
                    points.append(p.lerp(mean, weight))
                else:
                    points.append(p.copy())
            for vertex, p in zip(mesh.vertices, points):
                vertex.co = p
        mesh.update()
    points = []
    for vertex in mesh.vertices:
        p = vertex.co.copy()
        n = vertex.normal.normalized()
        x, y, z = p
        sign = math.copysign(1., x)
        front = smoothstep(-.10, .77, -n.y)
        rear = smoothstep(-.12, .72, n.y)
        def ridge(line, width, amplitude):
            return amplitude * (math.exp(-(line / width)**2)
                              - .66 * math.exp(-((line + 1.19 * width) / (.83 * width))**2))
        if kind == 'shorts':
            # These diagonal wakes begin below the drawcord and under the
            # side seam. The pocket and crotch keep their tailored volume.
            t = abs(x)
            draw = math.exp(-((t - .072) / .112)**2)
            outer = math.exp(-((t - .188) / .086)**2)
            direction = 1. if x > 0 else -.65
            pressure = front * (
                ridge(z - .826 + .69 * t - .015 * direction, .020, .010) * draw
                + ridge(z - .758 - .49 * (t - .16) + .009 * sign, .026, .0095) * outer
                + ridge(z - .682 + .34 * (t - .11) - .014 * sign, .022, .0057) * outer)
            pressure += rear * (ridge(z - .792 + .28 * (t - .10), .027, .008) * outer
                                + ridge(z - .690 - .38 * t - .014 * sign, .025, .006) * draw)
            # Elastic compresses in small, uneven pleats immediately below
            # the loop, distinct from the broad folds in the legs.
            waist = smoothstep(.861, .917, z) * (1. - smoothstep(.918, .956, z))
            a = math.atan2(x, -y - .020)
            pressure += waist * (.0033 * math.cos(25 * a + .62 * math.cos(7 * a))
                                + .00155 * math.cos(37 * a + .45))
        else:
            arm = smoothstep(.180, .235, abs(x))
            near_elbow = math.exp(-((z - (1.069 + .014 * sign)) / .120)**2)
            plane = smoothstep(-.13, .68, -n.y) * (.67 + .33 * smoothstep(-.1, .58, -sign*n.x))
            crease = z - (1.083 + .014 * sign) + (.51 - .10 * sign) * (y + .031)
            fore = z - (1.008 + .018 * sign) - .62 * (y + .043)
            wrist = z - (.915 + .013 * sign) + .54 * (y + .061)
            pressure = arm * (
                plane * near_elbow * ridge(crease, .019, .0089)
                + rear * near_elbow * ridge(fore, .029, .0048)
                + (.32 + .68 * front) * ridge(wrist, .012, .0051)
                + rear * ridge(wrist - .032, .015, .0040)
            )
            side_support = math.exp(-((abs(x) - .179) / .076)**2)
            body = 1. - arm
            pressure += body * (
                front * side_support * ridge(z - 1.156 - .58 * (abs(x) - .17), .027, .0066)
                + front * side_support * ridge(z - (.971 + .023 * sign) + .54 * (abs(x) - .17), .023, .0080)
                + rear * side_support * ridge(z - (.961 - .015 * sign) - .48 * (abs(x) - .155), .028, .0067)
                + front * math.exp(-((abs(x)-.062)/.061)**2) * ridge(z - .919 - .48*abs(x), .024, .0044)
            )
            # The thicker finished hem draws the cloth into small uneven
            # folds immediately above the waistband, fading into the body.
            edge = math.atan2(x, -y - .022)
            gather = math.exp(-((z - .888) / .030)**2)
            pressure += body * gather * (.0029 * math.cos(17*edge + .72*math.cos(5*edge))
                                          + .0013*math.cos(24*edge + .17))
            if y < -.07:
                strain = math.exp(-((abs(x) - .021) / .023)**2)
                pressure += strain * (ridge(z - (.982 + abs(x) * .62), .032, .0022)
                                      + ridge(z - (1.227 - abs(x) * .36), .049, .0025))
        points.append(p + n * pressure)
    for vertex, point in zip(mesh.vertices, points):
        vertex.co = point
    mesh.update()


def settle_hoodie_seams(mesh):
    # Relax the cut-and-sewn shoulder line without erasing the collar or
    # ironing out the longer folds across the sleeve and fleece body.
    neighbors = defaultdict(list)
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbors[a].append(b)
        neighbors[b].append(a)
    loops = list(fit.edge_loops(mesh))
    border = {i for loop in loops for i in loop}
    for _ in range(5):
        refined = []
        for vertex in mesh.vertices:
            p = vertex.co
            outer = smoothstep(.087, .134, abs(p.x))
            shoulder = math.exp(-((p.z - 1.324) / .056)**2)
            weight = .55 * outer * shoulder * (1 - smoothstep(.225,.282,abs(p.x)))
            connected = neighbors[vertex.index]
            if vertex.index in border or weight < .025 or not connected:
                refined.append(p.copy())
            else:
                mean = sum((mesh.vertices[i].co for i in connected),Vector()) / len(connected)
                refined.append(p.lerp(mean,weight))
        for vertex,p in zip(mesh.vertices,refined):
            vertex.co = p
    for loop in loops:
        edge = [mesh.vertices[i].co.copy() for i in loop]
        axis = sum(edge, Vector()) / len(edge)
        if abs(axis.x) < .20 or axis.z > 1.0:
            continue
        side = math.copysign(1.,axis.x)
        for vertex in mesh.vertices:
            p = vertex.co
            if p.x*side < .203 or abs(p.z-axis.z) > .061:
                continue
            distance = min((p-q).length for q in edge)
            weight = 1 - smoothstep(.003,.031,distance)
            p.x += (axis.x-p.x)*.27*weight
            p.y += (axis.y-p.y)*.19*weight
    mesh.update()


class PanelSurface:
    def __init__(self, mesh, panels=None):
        mesh.calc_loop_triangles()
        self.mesh = mesh
        self.uv = mesh.uv_layers['Print'].data
        self.triangles = [tri for tri in mesh.loop_triangles
                          if panels is None or mesh.polygons[tri.polygon_index].material_index in panels]
        self.vertices = [v.co for v in mesh.vertices]
        self.tree = BVHTree.FromPolygons(self.vertices, [tri.vertices for tri in self.triangles], all_triangles=True)

    def print_at(self, point, index):
        triangle = self.triangles[index]
        corners = [self.vertices[i] for i in triangle.vertices]
        uv = [Vector((*self.uv[i].uv, 0.)) for i in triangle.loops]
        return barycentric_transform(point, *corners, *uv).xy

    def front(self, x, z):
        return self.tree.ray_cast(Vector((x, -.6, z)), Vector((0., 1., 0.)), .95)


def sleeve_distance(mesh, openings):
    # Measure along the sewn sleeve instead of projecting onto a straight arm.
    neighbors = defaultdict(list)
    for edge in mesh.edges:
        a, b = edge.vertices
        length = (mesh.vertices[a].co - mesh.vertices[b].co).length
        neighbors[a].append((b, length))
        neighbors[b].append((a, length))
    queue = []
    distance = [math.inf] * len(mesh.vertices)
    for loop in openings:
        for index in loop:
            distance[index] = 0.
            heappush(queue, (0., index))
    while queue:
        cost, index = heappop(queue)
        if cost != distance[index] or cost > .075:
            continue
        for other, length in neighbors[index]:
            size = cost + length
            if size < distance[other]:
                distance[other] = size
                heappush(queue, (size, other))
    return distance


def clip_panel(polygon, measure):
    result = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        start, end = measure(a), measure(b)
        if start >= 0.:
            result.append(a)
        if (start < 0.) != (end < 0.):
            t = start / (start - end)
            result.append((a[0].lerp(b[0], t), a[1].lerp(b[1], t).normalized(),
                           a[2].lerp(b[2], t), a[3] * (1-t) + b[3]*t, a[4] * (1-t) + b[4]*t))
    return result


def emit_panel(target, polygon):
    for i in range(1, len(polygon) - 1):
        for p, n, uv, ao, _ in (polygon[0], polygon[i], polygon[i+1]):
            target.indices.append(target.vertex(p, n, uv, ao))


def knit_panel(polygon, shell, rib, width):
    emit_panel(shell, clip_panel(polygon, lambda v: v[4] - width))
    knit = clip_panel(polygon, lambda v: width - v[4])
    for i in range(1, len(knit) - 1):
        face = (knit[0], knit[i], knit[i+1])
        for p, n, uv, ao, dist in face:
            roll = smoothstep(.001, .008, dist) * (1. - smoothstep(width-.007, width, dist))
            tex = (uv.x, clamp(dist / width))
            rib.indices.append(rib.vertex(p + n * (.00235 * roll), n, tex, ao))
        for p, n, uv, ao, dist in reversed(face):
            tex = (uv.x, clamp(dist / width))
            rib.indices.append(rib.vertex(p - n * .00265, -n, tex, .69 * ao))


def emit_panels(mesh, dest, names, *, bands=None):
    surface = PanelSurface(mesh)
    ao = fit.bake_occlusion(mesh, surface.tree)
    for tri in surface.triangles:
        panel = mesh.polygons[tri.polygon_index].material_index
        name = names[panel]
        target = dest[name]
        loops = list(tri.loops)
        us = [surface.uv[i].uv.x for i in loops]
        vertices = []
        band = bands.get(name) if bands else None
        for i in loops:
            vertex = mesh.vertices[mesh.loops[i].vertex_index]
            uv = surface.uv[i].uv.copy()
            if max(us) - min(us) > .52 and uv.x < .46 and len(names) == 2:
                uv.x = 1.
            distance = min(band[0][vertex.index], .10) if band else .1
            vertices.append((vertex.co, vertex.normal, uv, ao[vertex.index], distance))
        if bands and panel == 0 and min(abs(p[0].x) for p in vertices) < .015:
            # The closed zipper still has a true narrow break in the fleece.
            panels = [clip_panel(vertices, lambda v: v[0].x - .0045),
                      clip_panel(vertices, lambda v: -v[0].x - .0045)]
        else:
            panels = [vertices]
        for polygon in panels:
            if band and any(v[4] <= band[1] for v in polygon):
                knit_panel(polygon, target, dest['punos'], band[1])
            else:
                emit_panel(target, polygon)
    return surface


def turned_edge(mesh, path, target, surface, width, thickness, uv=None):
    # Three exterior rows and two return rows make an actual turned fabric edge.
    layers = [
        (-width, .00025, 1, -.2, 0., .93),
        (-width * .85, thickness * .66, 1, -.10, .16, 1.),
        (-width * .30, thickness * .76, 1, 0., .64, 1.),
        ( .0004, thickness * .39, .66, .71, .94, .93),
        ( .0005, -thickness * .53, -.50, .80, 1., .78),
        (-width * .23, -thickness, -1, .08, .73, .68),
    ]
    fit.make_band(mesh, path, layers, target, surface, uv)


def ribbon(target, rows):
    indices = []
    for row in rows:
        indices.append([target.vertex(*vertex) for vertex in row])
    for a, b in zip(indices, indices[1:]):
        for i in range(len(a) - 1):
            target.indices.extend((a[i], a[i+1], b[i+1], a[i], b[i+1], b[i]))


def piping(target, points, radius):
    rows = []
    distance = 0.
    for i, p in enumerate(points):
        axis = (points[min(len(points)-1, i+1)] - points[max(0, i-1)]).normalized()
        a = axis.cross(Vector((0., 1., 0.))).normalized()
        b = axis.cross(a).normalized()
        if i:
            distance += (p - points[i-1]).length
        ring = []
        for j in range(9):
            angle = j / 8 * math.tau
            n = math.cos(angle) * a + math.sin(angle) * b
            ring.append((p + radius * n, n, (j / 8, (distance * 8) % 1.), .97))
        rows.append(ring)
    ribbon(target, rows)


def bezier(points, count=26):
    a, b, c, d = points
    for i in range(count + 1):
        t = i / count
        yield (1-t)**3 * a + 3 * (1-t)**2 * t * b + 3 * (1-t) * t*t * c + t**3 * d


def pocket(target, thread, surface, side):
    # Split kangaroo bag with a lifted diagonal free edge over the fleece body.
    rows, opening, turn = [], [], []
    for j in range(25):
        t = j / 24
        z = .898 + .133 * t
        outer = .158 - .065 * smoothstep(.20, 1., t)
        row = []
        for i in range(19):
            u = i / 18
            x = side * (.014 + (outer - .014) * u)
            p, n, tri, _ = surface.front(x, z)
            lip = math.sin(math.pi * t) ** 1.25 * u ** 6
            swell = math.sin(math.pi * u) * math.sin(math.pi * t)
            row.append((p + n * (.0021 + .006 * swell + .0068 * lip),
                        n, surface.print_at(p, tri), 1. - .12 * lip))
        lip, normal, tex, _ = row[-1]
        opening.append(lip)
        inset = side * -.0042
        turn.append([
            (lip + Vector((inset, -.0009, .0012)), normal, tex, .96),
            (lip + Vector((0., -.0011, 0.)), normal, tex, .89),
            (lip + Vector((0., .0018, -.0008)), normal, tex, .66),
        ])
        rows.append(row if side > 0 else row[::-1])
    ribbon(target, rows)
    ribbon(target, [row if side > 0 else row[::-1] for row in turn])
    for a, b in zip(opening, opening[1:]):
        if (b - a).length < .0001:
            continue
        n = Vector((0, -1, 0))
        pa, _, ia, _ = surface.front(a.x, a.z)
        pb, _, ib, _ = surface.front(b.x, b.z)
        fit.stitch_segment(a, b, n, n, (surface.print_at(pa, ia), surface.print_at(pb, ib)), thread, .0006)


def zip_link(target, center, width, height, depth):
    # The chamfer catches a small highlight on each interlocking tooth.
    rows = []
    for ratio, y in ((1., 0.), (1., -depth*.60), (.77, -depth)):
        p = center + Vector((0., y, 0.))
        ring = []
        for i, (x, z) in enumerate(((-1.,-1.),(1.,-1.),(1.,1.),(-1.,1.),(-1.,-1.))):
            n = Vector((x*.37, -.9, z*.37)).normalized()
            ring.append((p+Vector((width*x*ratio,0.,height*z*ratio)),n,(i/4,0.),1.))
        rows.append(ring)
    ribbon(target, rows)
    face = [target.vertex(p, Vector((0.,-1.,0.)), uv, 1.) for p, _, uv, _ in rows[-1][:4]]
    target.indices.extend(face[i] for i in (0,1,2,0,2,3))


def zipper(fleece, rib, thread, tape, teeth, surface):
    center = []
    for i in range(206):
        height = .812 + i * .00305
        point, normal, _, _ = surface.front(0., height)
        if point is not None and normal.y < -.18 and point.y < -.038:
            center.append(point)
    if len(center) < 5:
        raise ValueError('Could not locate the zipper center line')
    rows = []
    n = Vector((0., -1., 0.))
    for i, p in enumerate(center):
        rows.append([(p+Vector((x,depth,0.)),n,(u,i/(len(center)-1)),occlusion)
                     for x, depth, u, occlusion in [(-.0088,-.0004,0.,.78),
                     (-.0035,.0003,.28,.80),(0.,.0012,.50,.64),
                     (.0035,.0003,.72,.80),(.0088,-.0004,1.,.78)]])
        offset = -.00068 if i % 2 else .00068
        zip_link(teeth, p+Vector((offset,-.0006,0.)), .00223, .00117, .0020)
    ribbon(tape, rows)

    for side in [-1, 1]:
        facing, stitches = [], []
        for p in center:
            q, natural, tri, _ = surface.front(side*.012, p.z)
            if q is None:
                continue
            uv = surface.print_at(q, tri)
            row = []
            # Sewn seam, rolled edge, and fleece return facing the teeth.
            for x, raised, shade in ((.016, .00015, .98),(.011, .00185, 1.),
                                      (.0065,.00425,.98),(.0046,.00325,.87),
                                      (.00455,-.00040,.68)):
                xyz, normal, sample, _ = surface.front(side*x, p.z)
                coord = xyz if xyz is not None else q
                tex = surface.print_at(coord,sample) if sample is not None else uv
                row.append((Vector((side*x,coord.y-raised,p.z)),natural,tex,shade))
            facing.append(row if side < 0 else row[::-1])
            stitches.append((row[1][0], natural, row[1][2]))
        # At the hem the folded edge is knit from the waistband fabric.
        # Keep the two materials joined without printing a fleece strip
        # over the knit on either side of the zipper.
        hem = center[0].z
        join = next((i for i,row in enumerate(facing) if row[0][0].z >= hem+.0385), 1)
        waistband = [
            [(p,n,(side*.028+.5+j*.007,clamp((p.z-hem)/.0385)),ao)
             for j,(p,n,_,ao) in enumerate(row)]
            for row in facing[:join+1]
        ]
        ribbon(rib,waistband)
        ribbon(fleece,facing[join:])
        for (a,n0,uv0),(b,n1,uv1) in zip(stitches[join:], stitches[join+1:]):
            if (b-a).length < .0062:
                fit.stitch_segment(a,b,n0,n1,(uv0,uv1),thread,.00036)

    start = center[0] + Vector((0., -.0013, .001))
    zip_link(teeth,start,.0031,.0035,.0023)
    top = center[-3] + Vector((0.,-.0035,0.))
    zip_link(teeth,top,.0042,.0052,.0027)
    pull = [top + Vector((.00315*math.cos(i*math.tau/28),
                         -.004-.003*math.sin(i*math.tau/28),
                         -.012+.008*math.sin(i*math.tau/28))) for i in range(29)]
    piping(teeth, pull, .0013)


def write_buffers(output, dest):
    with BytesIO() as stream:
        stream.write(b'IT02')
        for part in dest.values():
            part.write(stream)
        output.write_bytes(zlib.compress(stream.getvalue(), level=9))
    print(f'{output.stat().st_size:,} bytes compressed')


def section_curve(points, t):
    # A cubic spline through the measured sewing landmarks.
    n = len(points) - 1
    s = clamp(t) * n
    k = min(n - 1, int(s))
    x = s - k
    a, b, c, d = (points[i] for i in (max(0,k-1), k, k+1, min(n,k+2)))
    return .5 * ((2*b) + (-a+c)*x + (2*a-5*b+4*c-d)*x*x + (-a+3*b-3*c+d)*x**3)


def neck_halves(mesh, path):
    positions = [mesh.vertices[i].co.copy() for i in path]
    def score(index, side):
        p = positions[index]
        return side * p.y + .76 * abs(p.x)
    front = min(range(len(path)), key=lambda i: score(i, 1))
    back = min(range(len(path)), key=lambda i: score(i, -1))
    halves = {}
    for step in (-1, 1):
        i = front
        piece = [positions[i]]
        while i != back:
            i = (i + step) % len(path)
            piece.append(positions[i])
        side = 1 if sum(p.x for p in piece) > 0 else -1
        halves[side] = piece
    return halves


def laid_hood(target, lining, thread, mesh, neckline):
    halves = neck_halves(mesh, neckline)
    body_back = PanelSurface(mesh, {1})
    torso_surface = PanelSurface(mesh, {0, 1})
    points = {}
    count, depth = 52, 35

    for side, neck in halves.items():
        # Each fleece panel runs from the stitched neck seam to its opening
        # and meets the other panel vertically down the back crown seam.
        base = [p+Vector((0.,0.,.00115)) for p in neck]
        base[0].x = side * .0085
        base[-1].x = 0.
        rim = [
            base[0] + Vector((side*.001, -.004, .004)),
            Vector((side*.049, -.052, 1.425 + .003*side)),
            Vector((side*.095, -.015, 1.435 + .003*side)),
            Vector((side*.124, .051, 1.418 - .002*side)),
            Vector((side*.080, .101, 1.387 - .005*side)),
            Vector((0., .114, 1.386)),
        ]
        spine = [
            base[-1], Vector((0., .069, 1.382)),
            Vector((0., .099, 1.323)), Vector((0., .109, 1.279)),
            Vector((0., .124, 1.318)), rim[-1],
        ]
        rows = []
        for i in range(count + 1):
            u = i / count
            a, b = section_curve(base, u), section_curve(rim, u)
            row = []
            for j in range(depth + 1):
                v = j / depth
                center = section_curve(spine, v) - base[-1].lerp(rim[-1], v)
                p = a.lerp(b,v) + center * math.sin(.5*math.pi*u)**3.1
                area = math.sin(math.pi*u)**1.4 * math.sin(math.pi*v)
                p.x += side * .020 * area
                valley = v - (.58 + .15*(u-.52) + side*.06)
                fold = math.exp(-(valley/.092)**2) - .60*math.exp(-((valley+.12)/.088)**2)
                p.y += area * (.012 + side*.0025) * fold
                p.z -= area * (.011 + side*.004) * (u+.10)
                # A turned opening has a rounded fold just inside the edge.
                roll = math.exp(-((v-.886)/.082)**2)*math.sin(math.pi*u)**.63
                p.z += .0056*roll
                p.y -= .0043*roll
                if p.y > .010 and p.z < 1.408 and v > .05:
                    support, _, _, _ = body_back.tree.ray_cast(
                        Vector((p.x,.45,p.z)),Vector((0.,-1.,0.)),.53)
                    if support is not None:
                        grade = smoothstep(.055,.27,v)
                        gap = .009 + .021*smoothstep(1.29,1.405,p.z)*smoothstep(.31,.95,v)
                        desired = support.y + gap
                        p.y += (desired-p.y)*grade*(.67 if p.y > desired else 1.)
                # In front of the back fold the hood platform is the shoulder,
                # not the chest or the body interior. Constrain the clearance
                # along its loft axis, then pick up the rear contact further back.
                if v > .015 and p.y < .066:
                    support, direction, _, _ = torso_surface.tree.ray_cast(
                        Vector((p.x,p.y,1.57)), Vector((0.,0.,-1.)), .35)
                    if support is not None and direction.z > .14:
                        shoulder = 1. - smoothstep(.026,.066,p.y)
                        clearance = .00235 + .00125*smoothstep(.02,.16,v)
                        lift = max(0., support.z+clearance-p.z)
                        p.z += shoulder*lift*smoothstep(.014,.091,v)
                row.append(p)
            rows.append(row)
        points[side] = rows

    # Both sides share one winding and one normal at the sewn crown.
    # Matching the normal prevents a harsh lighting break down the seam.
    right = points[1]
    ref_i, ref_j = round(.42*count), round(.80*depth)
    right_du = right[ref_i+1][ref_j] - right[ref_i-1][ref_j]
    right_dv = right[ref_i][ref_j+1] - right[ref_i][ref_j-1]
    right_winding = 1 if right_du.cross(right_dv).x > 0 else -1
    seam_normals = []
    for j in range(depth+1):
        across = right[-2][j] - points[-1][-2][j]
        along = right[-1][min(depth,j+1)] - right[-1][max(0,j-1)]
        seam_normals.append(along.cross(across).normalized() * right_winding)
    normal_rows = {}
    for side, grid in points.items():
        winding = right_winding * side
        rows, inside, normals = [], [], []
        for i, points_across in enumerate(grid):
            u = i / count
            row, inner, directions = [], [], []
            for j, p in enumerate(points_across):
                v = j / depth
                du = grid[min(count,i+1)][j] - grid[max(0,i-1)][j]
                dv = grid[i][min(depth,j+1)] - grid[i][max(0,j-1)]
                n = du.cross(dv).normalized() * winding
                n = n.lerp(seam_normals[j], smoothstep(.83,1.,u)).normalized()
                tex = (.5+side*.5*(1-u),v)
                row.append((p,n,tex,.88+.12*smoothstep(.10,.81,v)))
                inner.append((p-n*.0028,-n,tex,.54+.26*smoothstep(.16,.98,v)))
                directions.append(n)
            rows.append(row)
            inside.append(inner)
            normals.append(directions)
        normal_rows[side] = normals
        ribbon(target,[row[::-1] if winding == 1 else row for row in rows])
        ribbon(lining,[row if winding == 1 else row[::-1] for row in inside])
        roll = []
        for i in range(count + 1):
            p = grid[i][-1]
            n = normals[i][-1]
            outward = (p-grid[i][-2]).normalized()
            u = .5 + side*.5*(1-i/count)
            roll.append([
                (p-.0029*outward+.0014*n, n, (u,.982), .98),
                (p+.0017*outward+.0010*n, (n+outward).normalized(), (u,.994), .95),
                (p+.0021*outward-.0021*n, (outward-n).normalized(), (u,1.), .81),
                (p-.0016*outward-.0030*n, -n, (u,.985), .71),
            ])
        ribbon(target, [row[::-1] if winding == 1 else row for row in roll])
    # The center seam follows the crown turn and is stitched into the fabric.
    center = points[1][-1]
    normals = normal_rows[1][-1]
    for j in range(depth):
        fit.stitch_segment(center[j], center[j+1], normals[j], normals[j+1],
                           ((.5,j/depth),(.5,(j+1)/depth)), thread, .0007)
    return {side: grid[round(.17*count)][-5] for side, grid in points.items()}


def resting_cord(entry, side, front):
    points = []
    length = .171 + side * .016
    for i in range(36):
        t = i / 35
        x = entry.x + side * (.010*t - .007*math.sin(math.pi*t))
        z = entry.z - length*t
        p, _, _, _ = front.front(x, z)
        natural = p.y if p is not None and p.y < -.055 else entry.y - .016*t
        weight = smoothstep(.04, .37, t)
        y = (entry.y-.006-.022*t)*(1-weight) + (natural-.010-.008*t)*weight
        points.append(Vector((x,y,z)))
    return points


def export_hoodie(obj, output):
    mesh = obj.data
    names = ('torso','sleeve','punos','hood','neckTape','zipMetal','cord','bodyThread','hoodThread','lining')
    dest = {name:Buffer(name) for name in names}
    cuffs, waist, neck = [], None, None
    for path in fit.edge_loops(mesh):
        center = sum((mesh.vertices[i].co for i in path), Vector()) / len(path)
        if center.z > 1.32:
            neck = path
        elif abs(center.x) > .19:
            cuffs.append(path)
        else:
            waist = path
    if neck is None or waist is None or len(cuffs) != 2:
        raise ValueError('Expected a neck, waistband, and two sleeve openings')
    emit_panels(mesh,dest,('torso','torso','sleeve'),bands={
        'torso': (sleeve_distance(mesh,[waist]),.041),
        'sleeve': (sleeve_distance(mesh,cuffs),.044),
    })
    body_surface = PanelSurface(mesh,{0,1})
    sleeve_surface = PanelSurface(mesh,{2})
    for path in cuffs:
        turned_edge(mesh,path,dest['punos'],sleeve_surface.tree,.0034,.0027)
    turned_edge(mesh,waist,dest['punos'],body_surface.tree,.0042,.0032)
    front = PanelSurface(mesh,{0})
    turned_edge(mesh,neck,dest['hood'],body_surface.tree,.0052,.0018)
    anchors = laid_hood(dest['hood'],dest['lining'],dest['hoodThread'],mesh,neck)
    for side in [-1,1]:
        pocket(dest['torso'],dest['bodyThread'],front,side)
    zipper(dest['torso'],dest['punos'],dest['bodyThread'],dest['neckTape'],dest['zipMetal'],front)
    for side, entry in anchors.items():
        eyelet = [entry+Vector((.00345*math.cos(i*math.tau/25),-.004,.00345*math.sin(i*math.tau/25)))
                  for i in range(26)]
        piping(dest['zipMetal'],eyelet,.00085)
        cord = resting_cord(entry,side,front)
        end = cord[-1]
        piping(dest['cord'],cord,.00215)
        piping(dest['zipMetal'],[end,end+Vector((0.,.0008,-.0105))],.00176)
    write_buffers(output,dest)


def export_shorts(obj, output):
    mesh = obj.data
    names = ('short', 'shortPlain', 'punos', 'cord', 'shortThread')
    dest = {name: Buffer(name) for name in names}
    surface = emit_panels(mesh, dest, ('short', 'shortPlain'))
    for path in fit.edge_loops(mesh):
        average = sum((mesh.vertices[i].co for i in path), Vector()) / len(path)
        if average.z > .86:
            turned_edge(mesh, path, dest['punos'], surface.tree, .031, .0027)
        else:
            name = 'short' if average.x > 0 else 'shortPlain'
            # The return is part of the leg panel, so its colour follows the shorts.
            uv = []
            for a, b in zip(path, path[1:] + path[:1]):
                row = []
                for i in (a, b):
                    p, _, face, _ = surface.tree.find_nearest(mesh.vertices[i].co)
                    row.append(tuple(surface.print_at(p, face)))
                if abs(row[0][0] - row[1][0]) > .50:
                    row[1] = row[0]
                uv.append(row)
            turned_edge(mesh, path, dest[name], surface.tree, .009, .0016, uv)
            fit.stitch_edge(mesh, path, dest['shortThread'], surface.tree, surface.print_at, offsets=(.0115,))
    pivot = None
    for height in (.928, .920, .909, .895):
        p, n, _, _ = surface.front(0., height)
        if p is not None and n.y < -.22 and p.y < -.05:
            pivot = p + Vector((0., -.012, 0.))
            break
    if pivot is not None:
        for side in [-1, 1]:
            end = pivot + Vector((side * .015, -.020, -.082 - .008 * side))
            piping(dest['cord'], list(bezier([pivot, pivot + Vector((side*.023,-.014,.004)),
                                             end + Vector((side*.001,-.005,.035)), end])), .00165)
            piping(dest['cord'], list(bezier([pivot, pivot + Vector((side*.052,-.015,.038)),
                                             pivot + Vector((side*.033,-.027,-.026)), pivot])), .00165)
    write_buffers(output, dest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=('hoodie', 'shorts'))
    parser.add_argument('garment', type=Path)
    parser.add_argument('body', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = fit.import_mesh(args.garment, f'Cloth_{args.kind}')
    body = fit.import_mesh(args.body, 'Body')
    for label in ('Second panel', 'Sleeves', 'Hood'):
        obj.data.materials.append(bpy.data.materials.new(label))
    shorts = args.kind == 'shorts'
    clean(obj, (lambda uv: int(uv.x > .5)) if shorts else hoodie_panel)
    clean(body, None, (.47, 1.11) if shorts else (.70, 1.56))
    if not shorts:
        remove_original_hood(obj)
    fit.subdivide(obj, 'Cut and sewn panels')
    add_uv(obj, args.kind)
    if shorts:
        for v in body.data.vertices:
            v.co.x *= .97
            v.co.y = -.023 + (v.co.y + .023) * .96
        prepare_shorts(obj)
        fit.drape(obj, body, 23, pin=lambda p: smoothstep(.876, .923, p.z), limit=.024)
    else:
        pose_hoodie_arms(obj, garment=True)
        pose_hoodie_arms(body, garment=False)
        def support(p):
            shoulder = smoothstep(1.30, 1.375, p.z) * (1. - smoothstep(.142, .218, abs(p.x)))
            wrist = (1. - smoothstep(.89, .958, p.z)) * smoothstep(.175, .253, abs(p.x)) * .65
            return max(shoulder, wrist, smoothstep(1.34, 1.39, p.z))
        fit.drape(obj, body, 24, pin=support, limit=.022, heavy=True)
    if not shorts:
        fit.subdivide(obj, 'Settled fleece')
    if not shorts:
        settle_hoodie_seams(obj.data)
    sculpt(obj.data, args.kind)
    (export_shorts if shorts else export_hoodie)(obj, args.output)


if __name__ == '__main__':
    main()
