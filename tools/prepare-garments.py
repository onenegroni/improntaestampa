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


def prepare_hoodie(obj, body):
    panels = defaultdict(set)
    for face in obj.data.polygons:
        for i in face.vertices:
            panels[i].add(face.material_index)
    for vertex in obj.data.vertices:
        p = vertex.co.copy()
        if panels[vertex.index] == {3}:
            # Keep the existing crown and opening, and seat it against the
            # upper back with space between the outer fleece and the lining.
            p.x *= .77
            p.z = 1.425 + (p.z - 1.445) * .72
            resting_back = 1. - smoothstep(1.27, 1.40, p.z)
            p.y += .010 + .015 * resting_back
            shoulder = smoothstep(.06, .125, abs(p.x)) * smoothstep(1.344, 1.411, p.z)
            p.z += shoulder * .010
            p.y -= shoulder * .020
        elif 2 in panels[vertex.index]:
            side = math.copysign(1., p.x)
            elbow = Vector((side * .331, -.020, 1.140))
            axis = Vector((side * .122, -.163, -.124)).normalized()
            distance = (p - elbow).dot(axis)
            guide = elbow + axis * distance
            wrist = smoothstep(.093, .227, distance)
            p = guide + (p - guide) * (1. - .31 * wrist)
            p = fit.relaxed_arm(p)
        else:
            hip = 1. - smoothstep(.934, 1.23, p.z)
            p.x += math.copysign(.011 * hip, p.x)
            p.y += .027 * hip * (p.y + .026)
            # Break the even hem without tilting the zipper off centre.
            p.z += p.x * .031 * hip
        vertex.co = p
    for vertex in body.data.vertices:
        vertex.co = fit.relaxed_arm(vertex.co)
        vertex.co.x *= .966
        vertex.co.y = -.025 + (vertex.co.y + .025) * .975
    obj.data.update()
    body.data.update()


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
            arm = smoothstep(.181, .245, abs(x))
            lower = 1. - smoothstep(1.17, 1.30, z)
            # Staggered elbow compression on the forearm side, with a wider
            # hollow above the cuff where gravity draws the sleeve down.
            pressure = arm * lower * (
                (.18 + .82 * front) * ridge(z - (1.097 + .018 * sign) + .52 * (y + .025), .018, .0062)
                + (.24 + .76 * rear) * ridge(z - (1.032 + .011 * sign) - .52 * (y + .036), .024, .0054)
                + front * ridge(z - (.968 - .012 * sign) + .37 * (y + .042), .014, .0046))
            attachment = math.exp(-((abs(x) - .185) / .063)**2)
            body = 1. - arm
            pressure += body * (
                front * attachment * ridge(z - 1.159 - .70 * (abs(x) - .17), .025, .0104)
                + front * attachment * ridge(z - .916 + .46 * (abs(x) - .15), .022, .0070)
                + rear * attachment * ridge(z - .945 - .49 * (abs(x) - .155), .029, .0086))
        points.append(p + n * pressure)
    for vertex, point in zip(mesh.vertices, points):
        vertex.co = point
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


def cuff_face(triangle, sleeve, rib, width=.035):
    def cut(inside):
        poly = []
        for a, b in zip(triangle, triangle[1:] + triangle[:1]):
            ia, ib = (a[4] <= width) == inside, (b[4] <= width) == inside
            if ia:
                poly.append(a)
            if ia != ib:
                t = (width - a[4]) / (b[4] - a[4])
                poly.append((a[0].lerp(b[0], t), a[1].lerp(b[1], t).normalized(),
                             a[2].lerp(b[2], t), a[3] * (1-t) + b[3]*t, width))
        return poly

    outer = cut(False)
    for i in range(1, len(outer) - 1):
        for p, n, uv, ao, _ in (outer[0], outer[i], outer[i+1]):
            sleeve.indices.append(sleeve.vertex(p, n, uv, ao))
    cuff = cut(True)
    for i in range(1, len(cuff) - 1):
        face = (cuff[0], cuff[i], cuff[i+1])
        for p, n, uv, ao, dist in face:
            shape = smoothstep(0., .009, dist) * (1. - smoothstep(width-.007, width, dist))
            tex = (uv.x, clamp(dist / width))
            rib.indices.append(rib.vertex(p + n * (.0021 * shape), n, tex, ao))
        for p, n, uv, ao, dist in reversed(face):
            tex = (uv.x, clamp(dist / width))
            rib.indices.append(rib.vertex(p - n * .00225, -n, tex, .69 * ao))


def emit_panels(mesh, dest, names, cuff_dist=None):
    surface = PanelSurface(mesh)
    ao = fit.bake_occlusion(mesh, surface.tree)
    for tri in surface.triangles:
        name = names[mesh.polygons[tri.polygon_index].material_index]
        target = dest[name]
        loops = list(tri.loops)
        if cuff_dist is not None and name == 'sleeve':
            corners = [mesh.vertices[mesh.loops[i].vertex_index] for i in loops]
            distances = [min(cuff_dist[v.index], .10) for v in corners]
            if min(distances) <= .035:
                cuff_face([(v.co, v.normal, surface.uv[i].uv, ao[v.index], d)
                           for i, v, d in zip(loops, corners, distances)], target, dest['punos'])
                continue
        # Preserve periodic shorts texture interpolation at the inside leg.
        us = [surface.uv[i].uv.x for i in loops]
        for i in loops:
            vertex = mesh.vertices[mesh.loops[i].vertex_index]
            uv = surface.uv[i].uv.copy()
            if max(us) - min(us) > .52 and uv.x < .46 and len(names) == 2:
                uv.x = 1.
            target.indices.append(target.vertex(vertex.co, vertex.normal, uv, ao[vertex.index]))
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


def zipper(tape, teeth, surface):
    center = []
    for i in range(119):
        z = .850 + .0036 * i
        p, n, _, _ = surface.front(0., z)
        if p is None:
            continue
        center.append(p)
    # Extend the tape to the small gap at the front of the crew opening.
    for i in range(1, 41):
        p, _, _, _ = surface.front(0., 1.2748 + i * .0036)
        if p is None:
            break
        center.append(p)
    rows = []
    n = Vector((0, -1, 0))
    for i, p in enumerate(center):
        rows.append([(p + Vector((x, -depth, 0.)), n, (u, i / (len(center) - 1)), ao)
                     for x, depth, u, ao in [(-.007, .003, 0., .79), (-.0044, .0045, .18, .96),
                     (0., .0054, .5, .69), (.0044, .0045, .82, .96), (.007, .003, 1., .79)]])
        offset = -.00095 if i % 2 else .00095
        p = p + Vector((offset, -.0071, 0.))
        corners = [p + Vector((x, edge, dz)) for x, edge, dz in [
            (-.0023, .0008, -.00123), (.0023, .0008, -.00123), (.0023, 0., .00123), (-.0023, 0., .00123)]]
        row = [teeth.vertex(c, n, (u, v)) for c, (u, v) in zip(corners, [(0,0),(1,0),(1,1),(0,1)])]
        teeth.indices.extend(row[i] for i in (0,1,2,0,2,3))
    ribbon(tape, rows)
    top = center[-3] + Vector((0., -.0105, 0.))
    # The pull loop is a closed piece of hardware, separate from the tape.
    points = [top + Vector((.0035 * math.cos(i * math.tau / 32),
                           -.0014 * math.sin(i * math.tau / 32),
                           -.007 + .007 * math.sin(i * math.tau / 32))) for i in range(33)]
    piping(teeth, points, .00124)
    for side in [-1, 1]:
        entry, _, _, _ = surface.front(side * .052, 1.353)
        if entry is None:
            continue
        grommet = [entry + Vector((.0036 * math.cos(i*math.tau/24), -.0064, .0036 * math.sin(i*math.tau/24)))
                   for i in range(25)]
        piping(teeth, grommet, .00085)
        yield side, entry + Vector((0., -.007, 0.))


def write_buffers(output, dest):
    with BytesIO() as stream:
        stream.write(b'IT02')
        for part in dest.values():
            part.write(stream)
        output.write_bytes(zlib.compress(stream.getvalue(), level=9))
    print(f'{output.stat().st_size:,} bytes compressed')


def settle_hood(mesh):
    # Use the outer back panel as the contact surface for the folded crown.
    back = PanelSurface(mesh, {1})
    crown = {i for face in mesh.polygons if face.material_index == 3 for i in face.vertices}
    for i in crown:
        p = mesh.vertices[i].co
        hit, _, _, _ = back.tree.ray_cast(Vector((p.x, .48, p.z)), Vector((0., -1., 0.)), .65)
        if hit is None:
            continue
        settle = 1. - smoothstep(1.29, 1.397, p.z)
        supported = max(hit.y + .006, .27 * p.y + .73 * (hit.y + .020))
        p.y += settle * (supported - p.y)
    mesh.update()


def resting_cord(entry, side, front):
    points = []
    length = .146 + side * .013
    for i in range(31):
        t = i / 30
        x = entry.x + side * (.018 * t - .008 * math.sin(math.pi * t))
        z = entry.z - length * t
        p, _, _, _ = front.front(x, z)
        if p is not None:
            points.append(Vector((x, p.y - (.007 + .013 * t), z)))
    return points


def export_hoodie(obj, output):
    mesh = obj.data
    names = ('torso', 'sleeve', 'punos', 'hood', 'neckTape', 'zipMetal', 'cord', 'bodyThread')
    dest = {name: Buffer(name) for name in names}
    openings = []
    cuffs = []
    for path in fit.edge_loops(mesh):
        center = sum((mesh.vertices[i].co for i in path), Vector()) / len(path)
        openings.append((path, center))
        if abs(center.x) > .189 and center.z < 1.10:
            cuffs.append(path)
    emit_panels(mesh, dest, ('torso', 'torso', 'sleeve', 'hood'), sleeve_distance(mesh, cuffs))
    body_surface = PanelSurface(mesh, {0, 1})
    sleeve_surface = PanelSurface(mesh, {2})
    hood_surface = PanelSurface(mesh, {3})
    all_panels = defaultdict(set)
    for f in mesh.polygons:
        for i in f.vertices:
            all_panels[i].add(f.material_index)
    for path, average in openings:
        if all(all_panels[i] == {3} for i in path):
            turned_edge(mesh, path, dest['hood'], hood_surface.tree, .007, .0029)
        elif average.z > 1.32:
            turned_edge(mesh, path, dest['hood'], body_surface.tree, .011, .0026)
        elif abs(average.x) > .189:
            turned_edge(mesh, path, dest['punos'], sleeve_surface.tree, .004, .00225)
        else:
            turned_edge(mesh, path, dest['punos'], body_surface.tree, .037, .0031)
    front = PanelSurface(mesh, {0})
    for side in [-1, 1]:
        pocket(dest['torso'], dest['bodyThread'], front, side)
    for side, entry in zipper(dest['neckTape'], dest['zipMetal'], front):
        cord = resting_cord(entry, side, front)
        if len(cord) < 2:
            continue
        finish = cord[-1]
        piping(dest['cord'], cord, .0020)
        piping(dest['zipMetal'], [finish, finish + Vector((0., .0015, -.010))], .00176)
    write_buffers(output, dest)


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
    fit.subdivide(obj, 'Cut and sewn panels')
    add_uv(obj, args.kind)
    if shorts:
        for v in body.data.vertices:
            v.co.x *= .97
            v.co.y = -.023 + (v.co.y + .023) * .96
        prepare_shorts(obj)
        fit.drape(obj, body, 23, pin=lambda p: smoothstep(.876, .923, p.z), limit=.024)
    else:
        prepare_hoodie(obj, body)
        def support(p):
            shoulder = smoothstep(1.30, 1.375, p.z) * (1. - smoothstep(.142, .218, abs(p.x)))
            wrist = (1. - smoothstep(.89, .958, p.z)) * smoothstep(.175, .253, abs(p.x)) * .65
            return max(shoulder, wrist, smoothstep(1.34, 1.39, p.z))
        fit.drape(obj, body, 20, pin=support, limit=.018, heavy=True)
    if not shorts:
        fit.subdivide(obj, 'Settled fleece')
    sculpt(obj.data, args.kind)
    if not shorts:
        settle_hood(obj.data)
    (export_shorts if shorts else export_hoodie)(obj, args.output)


if __name__ == '__main__':
    main()
