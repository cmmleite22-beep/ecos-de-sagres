# Cenário à volta do percurso: margens com relevo, selva (palmeiras, árvores, arbustos, erva),
# rochas, montanhas ao fundo, ruínas distantes, cascatas, trepadeiras e pássaros.
class_name Scenery
extends RefCounted

var root: Node3D
var M: Mats
var rng := RandomNumberGenerator.new()
var noise := FastNoiseLite.new()
var anim: Array = []    # objetos animados (pássaros)
var high := true

func _init(parent: Node3D, mats: Mats, quality_high: bool) -> void:
	root = parent; M = mats; high = quality_high
	rng.seed = 2024
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 1.0
	noise.fractal_type = FastNoiseLite.FRACTAL_FBM
	noise.fractal_octaves = 4
	noise.seed = 9

static func sstep(a: float, b: float, x: float) -> float:
	var t := clampf((x - a) / (b - a), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)

func fbm(x: float, z: float) -> float:
	return noise.get_noise_2d(x * 10.0, z * 10.0) * 0.5 + 0.5

func height(x: float, z: float) -> float:
	var d := absf(x)
	var h := -1.8 + 2.1 * sstep(11.5, 17.0, d)
	h += sstep(16.0, 45.0, d) * (1.5 + 7.0 * fbm(x * 0.025 + 7.0, z * 0.025))
	h += sstep(45.0, 90.0, d) * 26.0 * fbm(x * 0.012 + 3.0, z * 0.012 + 9.0)
	h += sstep(15.0, 22.0, d) * (fbm(x * 0.2, z * 0.2) - 0.5) * 0.9
	return h

func build() -> void:
	terrain()
	mountains()
	jungle()
	rocks()
	distant_ruins()
	waterfall(Vector3(23, 0, 92), 15.0, 4.5, -PI / 2)
	waterfall(Vector3(-27, 0, 46), 8.0, 3.0, PI / 2 - 0.3)
	birds()

func _add(mesh: Mesh, mat: Material = null, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	if mat:
		mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	return mi

# ------------------------------------------------------------------ terreno
func terrain() -> void:
	var seg_x := 60 if high else 36
	var seg_z := 140 if high else 80
	for side in [-1.0, 1.0]:
		var W := 120.0
		var D := 300.0
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for j in seg_z + 1:
			for i in seg_x + 1:
				var u := float(i) / seg_x
				var x: float = side * (10.5 + pow(u, 1.6) * W)
				var z := -60.0 + float(j) / seg_z * D
				var y := height(x, z)
				var n := fbm(x * 0.08, z * 0.08)
				st.set_color(Color(0.9 + n * 0.2, 0.95 + n * 0.15, 0.9 + n * 0.1))
				st.set_uv(Vector2(x, z) * 0.14)
				st.add_vertex(Vector3(x, y, z))
		for j in seg_z:
			for i in seg_x:
				var a := j * (seg_x + 1) + i
				var b := a + 1
				var c := a + seg_x + 1
				var d := c + 1
				if side > 0:
					st.add_index(a); st.add_index(b); st.add_index(c)
					st.add_index(b); st.add_index(d); st.add_index(c)
				else:
					st.add_index(a); st.add_index(c); st.add_index(b)
					st.add_index(b); st.add_index(c); st.add_index(d)
		st.generate_normals()
		var mi := _add(st.commit(), M.m.ground, false)
		mi.name = "terrain"

func mountains() -> void:
	# cristas ao fundo: esferas deformadas, escurecidas pelo nevoeiro
	var specs := [[-150, 60, 70, 45], [160, 120, 80, 55], [-120, 230, 90, 60], [130, 260, 75, 48], [0, 330, 120, 70], [-60, 300, 70, 40], [90, -80, 60, 35]]
	for s in specs:
		var sm := SphereMesh.new()
		sm.radius = 1.0; sm.height = 2.0; sm.radial_segments = 24; sm.rings = 12
		var st := SurfaceTool.new()
		st.create_from(sm, 0)
		var arr := st.commit_to_arrays()
		var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		for i in v.size():
			var p := v[i]
			var k := 1.0 + (noise.get_noise_3d(p.x * 2.0 + s[0], p.y * 2.0, p.z * 2.0) * 0.35)
			v[i] = Vector3(p.x * s[2] * k, maxf(p.y, -0.2) * s[3] * k, p.z * s[2] * 0.7 * k)
		arr[Mesh.ARRAY_VERTEX] = v
		var am := ArrayMesh.new()
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var st2 := SurfaceTool.new()
		st2.create_from(am, 0)
		st2.generate_normals()
		var mi := _add(st2.commit(), M.m.rock, false)
		mi.position = Vector3(s[0], -4, s[1])

# ------------------------------------------------------------------ vegetação
func _palm_mesh() -> ArrayMesh:
	var am := ArrayMesh.new()
	# tronco curvo e anelado
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := 10
	var sides := 7
	var hgt := 7.0
	for r in rings + 1:
		var t := float(r) / rings
		var c := Vector3(t * t * 1.4, t * hgt, 0)
		var rad := lerpf(0.24, 0.14, t) * (1.0 + 0.08 * sin(t * 60.0))
		for s in sides + 1:
			var a := float(s) / sides * TAU
			var n := Vector3(cos(a), 0, sin(a))
			st.set_normal(n)
			st.set_uv(Vector2(float(s) / sides, t * 4.0))
			st.add_vertex(c + n * rad)
	for r in rings:
		for s in sides:
			var a := r * (sides + 1) + s
			var b := a + sides + 1
			st.add_index(a); st.add_index(b); st.add_index(a + 1)
			st.add_index(a + 1); st.add_index(b); st.add_index(b + 1)
	st.commit(am)
	# folhas: 9 fitas arqueadas a partir do topo
	var top := Vector3(1.4, hgt, 0)
	var sf := SurfaceTool.new()
	sf.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx := 0
	for f in 9:
		var ang := float(f) / 9.0 * TAU + rng.randf() * 0.3
		var dir := Vector3(cos(ang), 0, sin(ang))
		var side := Vector3(-dir.z, 0, dir.x)
		var length := 3.4 + rng.randf() * 0.8
		var segs := 5
		for k in segs + 1:
			var t := float(k) / segs
			var p := top + dir * (t * length) + Vector3(0, 0.6 * t - 1.9 * t * t, 0)
			var wdt := 0.75 * sin(t * PI * 0.9 + 0.15)
			for e in [-1.0, 1.0]:
				sf.set_normal(Vector3.UP)
				sf.set_uv(Vector2(0.5 + e * 0.5, 1.0 - t))
				sf.add_vertex(p + side * wdt * e + Vector3(0, -absf(e) * 0.15 * t, 0))
		for k in segs:
			var a := idx + k * 2
			sf.add_index(a); sf.add_index(a + 2); sf.add_index(a + 1)
			sf.add_index(a + 1); sf.add_index(a + 2); sf.add_index(a + 3)
		idx += (segs + 1) * 2
	sf.commit(am)
	am.surface_set_material(0, M.m.bark)
	am.surface_set_material(1, M.m.frond)
	return am

func _tree_mesh() -> ArrayMesh:
	var am := ArrayMesh.new()
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.22; trunk.bottom_radius = 0.42; trunk.height = 7.0; trunk.radial_segments = 8
	var st := SurfaceTool.new()
	st.append_from(trunk, 0, Transform3D(Basis(), Vector3(0, 3.5, 0)))
	st.commit(am)
	# copa: cartões de folhas cruzados à volta de vários centros
	var sf := SurfaceTool.new()
	sf.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx := 0
	for k in 14:
		var dir := Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.4, 1), rng.randf_range(-1, 1)).normalized()
		var c := Vector3(0, 7.5, 0) + dir * Vector3(2.6, 1.6, 2.6)
		var s := rng.randf_range(1.6, 2.4)
		for q in 3:
			var b := Basis(Vector3.UP, q * PI / 3.0 + rng.randf()) * Basis(Vector3.RIGHT, rng.randf_range(-0.4, 0.4))
			var corners := [Vector3(-s, -s, 0), Vector3(s, -s, 0), Vector3(s, s, 0), Vector3(-s, s, 0)]
			var uvs := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
			for i in 4:
				sf.set_normal((b * Vector3(0, 0.6, 1)).normalized())
				sf.set_uv(uvs[i])
				sf.add_vertex(c + b * corners[i])
			sf.add_index(idx); sf.add_index(idx + 1); sf.add_index(idx + 2)
			sf.add_index(idx); sf.add_index(idx + 2); sf.add_index(idx + 3)
			idx += 4
	sf.commit(am)
	am.surface_set_material(0, M.m.bark)
	am.surface_set_material(1, M.m.leaves)
	return am

func _cards_mesh(n: int, size: float, tall: float, mat: Material) -> ArrayMesh:
	var sf := SurfaceTool.new()
	sf.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx := 0
	for q in n:
		var b := Basis(Vector3.UP, q * PI / n)
		var corners := [Vector3(-size, 0, 0), Vector3(size, 0, 0), Vector3(size, tall, 0), Vector3(-size, tall, 0)]
		var uvs := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for i in 4:
			sf.set_normal(Vector3.UP)
			sf.set_uv(uvs[i])
			sf.add_vertex(b * corners[i])
		sf.add_index(idx); sf.add_index(idx + 1); sf.add_index(idx + 2)
		sf.add_index(idx); sf.add_index(idx + 2); sf.add_index(idx + 3)
		idx += 4
	var am := sf.commit()
	am.surface_set_material(0, mat)
	return am

func _scatter(mesh: Mesh, count: int, xmin: float, xmax: float, zmin: float, zmax: float, smin: float, smax: float, shadow := true, min_y := -0.1) -> void:
	var xs: Array = []
	for i in count * 3:
		if xs.size() >= count:
			break
		var side := -1.0 if rng.randf() < 0.5 else 1.0
		var x: float = side * rng.randf_range(xmin, xmax)
		var z := rng.randf_range(zmin, zmax)
		var y := height(x, z)
		if y < min_y:
			continue
		var s := rng.randf_range(smin, smax)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s, s))
		xs.append(Transform3D(b, Vector3(x, y - 0.1, z)))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mmi)

func jungle() -> void:
	var palm := _palm_mesh()
	var tree := _tree_mesh()
	var bush := _cards_mesh(3, 1.1, 1.6, M.m.leaves)
	var fern := _cards_mesh(4, 0.8, 0.9, M.m.frond)
	var grass := _cards_mesh(3, 0.45, 0.7, M.m.grassBlades)
	var k := 1.0 if high else 0.6
	_scatter(palm, int(70 * k), 12.5, 26.0, -40.0, 200.0, 0.8, 1.3)
	_scatter(palm, int(50 * k), 26.0, 60.0, -40.0, 230.0, 0.9, 1.4)
	_scatter(tree, int(80 * k), 22.0, 75.0, -50.0, 230.0, 0.9, 1.6)
	_scatter(bush, int(160 * k), 12.0, 40.0, -40.0, 210.0, 0.6, 1.3, false)
	_scatter(fern, int(160 * k), 12.0, 30.0, -40.0, 210.0, 0.7, 1.4, false)
	_scatter(grass, int(900 * k), 11.8, 28.0, -40.0, 210.0, 0.7, 1.5, false, 0.0)

func _rock_mesh(seed: int) -> ArrayMesh:
	var sm := SphereMesh.new()
	sm.radius = 1.0; sm.height = 2.0; sm.radial_segments = 12; sm.rings = 7
	var arr := sm.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	for i in v.size():
		var p := v[i]
		var kk := 1.0 + noise.get_noise_3d(p.x * 1.5 + seed * 13, p.y * 1.5, p.z * 1.5) * 0.45
		v[i] = Vector3(p.x * kk, p.y * kk * 0.7, p.z * kk * 1.1)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = null
	arr[Mesh.ARRAY_TANGENT] = null
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var st := SurfaceTool.new()
	st.create_from(am, 0)
	st.generate_normals()
	var out := st.commit()
	out.surface_set_material(0, M.m.rock)
	return out

func rocks() -> void:
	for sd in 3:
		_scatter(_rock_mesh(sd), 30, 11.0, 50.0, -40.0, 220.0, 0.4, 2.2, true, -1.5)

func rubble(list: Array) -> void:
	var mesh := _rock_mesh(7)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = list.size()
	for i in list.size():
		var r: Array = list[i]
		var s: float = r[3]
		mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s, s)), Vector3(r[0], r[1] + s * 0.3, r[2])))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	root.add_child(mmi)

func hanging_vines(list: Array) -> void:
	# cada trepadeira: um plano com folhas, pendurado de [x, y_topo, z, comprimento, rotação]
	var sf := SurfaceTool.new()
	sf.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx := 0
	for v in list:
		var b := Basis(Vector3.UP, v[4])
		var top := Vector3(v[0], v[1], v[2])
		var ln: float = v[3]
		var w := 0.45
		var corners := [Vector3(-w, -ln, 0), Vector3(w, -ln, 0), Vector3(w, 0, 0), Vector3(-w, 0, 0)]
		var uvs := [Vector2(0, ln * 0.6), Vector2(1, ln * 0.6), Vector2(1, 0), Vector2(0, 0)]
		for i in 4:
			sf.set_normal(b * Vector3(0, 0, 1))
			sf.set_uv(uvs[i])
			sf.add_vertex(top + b * (corners[i] + Vector3(0, 0, 0.06)))
		sf.add_index(idx); sf.add_index(idx + 1); sf.add_index(idx + 2)
		sf.add_index(idx); sf.add_index(idx + 2); sf.add_index(idx + 3)
		idx += 4
	var mat: ShaderMaterial = M.m.vine.duplicate()
	var tex: Texture2D = M.leaf_tex.leaves
	mat.set_shader_parameter("tex", tex)
	mat.set_shader_parameter("sway", 0.0)
	var am := sf.commit()
	var mi := _add(am, mat, false)
	mi.name = "vines"

func foam_ring(x: float, z: float, r: float) -> void:
	var tm := TorusMesh.new()
	tm.inner_radius = r * 0.8; tm.outer_radius = r * 1.25
	tm.rings = 24; tm.ring_segments = 4
	var mi := _add(tm, M.m.foam, false)
	mi.position = Vector3(x, -0.38, z)
	mi.scale = Vector3(1, 0.02, 1)

# ------------------------------------------------------------------ ruínas, cascatas, pássaros
func distant_ruins() -> void:
	for p in [[-52, 132, 1.0], [62, 38, 0.8], [-70, 20, 0.7]]:
		var base := height(p[0], p[1]) - 1.0
		var s: float = p[2]
		for i in 6:
			var w := (16.0 - i * 2.4) * s
			var bm := BoxMesh.new()
			bm.size = Vector3(w, 2.2 * s, w)
			var mi := _add(bm, M.m.mossStone)
			mi.position = Vector3(p[0], base + (i + 0.5) * 2.2 * s, p[1])
		var top := BoxMesh.new()
		top.size = Vector3(3.2 * s, 3 * s, 3.2 * s)
		var t := _add(top, M.m.carved)
		t.position = Vector3(p[0], base + 6 * 2.2 * s + 1.5 * s, p[1])
	# muros partidos e colunas soltas nas margens
	for i in 10:
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * rng.randf_range(16, 30)
		var z := rng.randf_range(0, 190)
		var y := height(x, z)
		if y < 0.0:
			continue
		var bm := BoxMesh.new()
		bm.size = Vector3(rng.randf_range(2, 5), rng.randf_range(1, 3.5), 0.9)
		var mi := _add(bm, M.m.mossStone)
		mi.position = Vector3(x, y + bm.size.y * 0.5 - 0.2, z)
		mi.rotation.y = rng.randf() * PI
		mi.rotation.z = rng.randf_range(-0.08, 0.08)

const FALL := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
uniform sampler2D noise : filter_linear_mipmap, repeat_enable;
void fragment() {
	float n = texture(noise, vec2(UV.x * 2.0, UV.y * 0.6 - TIME * 1.4)).r;
	float n2 = texture(noise, vec2(UV.x * 5.0 + 0.3, UV.y * 1.5 - TIME * 2.3)).r;
	float a = smoothstep(0.25, 0.75, n * 0.6 + n2 * 0.6) * (1.0 - smoothstep(0.85, 1.0, abs(UV.x - 0.5) * 2.0));
	ALBEDO = mix(vec3(0.55, 0.7, 0.72), vec3(1.0), a);
	ALPHA = 0.55 + a * 0.4;
}
"""

func waterfall(at: Vector3, h: float, w: float, rot: float) -> void:
	var y0 := height(at.x, at.z)
	var top := maxf(y0, 0.0) + h
	var pm := PlaneMesh.new()
	pm.size = Vector2(w, top + 0.4)
	pm.orientation = PlaneMesh.FACE_Z
	var sm := ShaderMaterial.new()
	var sh := Shader.new(); sh.code = FALL
	sm.shader = sh
	var nt := NoiseTexture2D.new()
	var fn := FastNoiseLite.new(); fn.frequency = 0.05
	nt.noise = fn; nt.seamless = true; nt.width = 128; nt.height = 256
	sm.set_shader_parameter("noise", nt)
	var mi := _add(pm, sm, false)
	mi.position = Vector3(at.x, (top - 0.4) * 0.5 - 0.2, at.z)
	mi.rotation.y = rot
	# rocha por trás da queda e espuma na base
	var rock := _add(_rock_mesh(11), M.m.rock)
	rock.position = mi.position + Basis(Vector3.UP, rot) * Vector3(0, -1, -3.6)
	rock.rotation.y = rot
	rock.scale = Vector3((w + 6) * 0.55, (top + 3) * 0.75, 4.0)
	foam_ring(at.x + sin(rot) * 1.0, at.z + cos(rot) * 1.0, w * 0.45)

func birds() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for v in [Vector3(-0.6, 0.1, 0), Vector3(0, 0, 0.15), Vector3(0, 0, -0.1), Vector3(0.6, 0.1, 0), Vector3(0, 0, -0.1), Vector3(0, 0, 0.15)]:
		st.set_normal(Vector3.UP); st.add_vertex(v)
	var mesh := st.commit()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.1, 0.1, 0.1)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	for i in 9:
		var b := _add(mesh, mat, false)
		anim.append({ "n": b, "c": Vector3(rng.randf_range(-30, 30), rng.randf_range(18, 30), rng.randf_range(20, 160)), "r": rng.randf_range(8, 20), "s": rng.randf_range(0.25, 0.5), "p": rng.randf() * TAU })

func update(t: float) -> void:
	for b in anim:
		var a: float = t * b.s + b.p
		var n: MeshInstance3D = b.n
		n.position = b.c + Vector3(cos(a) * b.r, sin(t * 0.7 + b.p) * 1.5, sin(a) * b.r)
		n.rotation.y = -a
		n.scale = Vector3(1, 1 + sin(t * 9.0 + b.p) * 0.6, 1)
