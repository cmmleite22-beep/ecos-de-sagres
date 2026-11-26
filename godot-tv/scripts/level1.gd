# Capítulo 1 — "O Templo das Marés" (mesmo percurso da versão web, ao longo de +Z)
class_name Level1
extends RefCounted

const ENEMY_SPOTS := [
	[-5, 3, 66.5], [5, 3, 62.5],
	[-2.5, 9, 83],
	[-3.5, 9, 102.5], [3.5, 9, 103],
	[-6, 3, 152], [6, 3, 156], [0, 3, 165.5],
]

const LINES := {
	"intro": [["Ana", "O mapa do Infante aponta para aqui. O Templo das Marés... existe mesmo."],
			["Tito", "Existe, e o Consórcio vem a caminho. Despachem-se."]],
	"stairs": [["Inês", "Inscrições em tâmil antigo e... português do século XV? Isto não faz sentido."]],
	"pillars": [["Rafa", "Os pilares aguentam. Saltem de um para o outro — empurrem o joystick até ao fim para correr."]],
	"spikes": [["Tito", "Lanças na pedra. E aqueles ali ao fundo são do Consórcio — já cá estão!"],
			["Ana", "Equipa avançada. Abatam-nos e passem as lanças com ritmo."]],
	"plates": [["Inês", "\"Dois devem pesar onde um não chega.\" As placas abrem o portão."]],
	"vines": [["Rafa", "Trepadeiras! Empurrem para a frente para subir."]],
	"bridge": [["Ana", "A plataforma move-se com a maré. Esperem por ela."]],
	"boulder": [["Tito", "Ouviram isto?!"], ["Ana", "CORRAM!"]],
	"altar": [["Tito", "Mais mercenários na câmara! Cubram-se atrás das colunas."],
			["Ana", "O Astrolábio de Âmbar... a primeira peça. Alguém que lhe pegue — botão AÇÃO."]],
	"win": [["Inês", "Há coordenadas gravadas no anel. O próximo templo fica em Socotra."],
			["Tito", "E o Consórcio acabou de aterrar. Saímos pelo rio. Agora!"]],
}

var root: Node3D
var world: Phys
var M: Mats
var scenery: Scenery
var high := true
var relics: Array = []
var spikes: Array = []
var plates: Array = []
var climbs: Array = []
var checkpoints: Array = []
var triggers: Array = []
var torches: Array = []
var lights := 0
var time := 0.0
var total_relics := 0
var gate := {}
var gate_latched := false
var mover := {}
var boulder := {}
var astrolabe: Node3D
var astrolabe_taken := false
var altar_pos := Vector3(0, 5.2, 160)
var water: MeshInstance3D
var _buckets := {}   # material -> SurfaceTool (blocos estáticos juntos numa só malha)
var _glow_tex: Texture2D

func _init(parent: Node3D, phys: Phys, mats: Mats, quality_high: bool) -> void:
	root = Node3D.new()
	root.name = "Level1"
	parent.add_child(root)
	world = phys; M = mats; high = quality_high
	build()

# ------------------------------------------------------------------ utilitários
func block(cx: float, y0: float, cz: float, w: float, h: float, d: float, mat = null, collide := true, dynamic := false, cast := true) -> Dictionary:
	var out := { "mesh": null, "col": null }
	var center := Vector3(cx, y0 + h * 0.5, cz)
	if mat != null:
		var bm := BoxMesh.new()
		bm.size = Vector3(w, h, d)
		if dynamic:
			var mi := MeshInstance3D.new()
			mi.mesh = bm
			mi.material_override = mat
			mi.position = center
			root.add_child(mi)
			out.mesh = mi
		else:
			_merge(bm, mat, Transform3D(Basis(), center), cast)
	if collide:
		out.col = world.add(Phys.Box.center(center, Vector3(w, h, d)), dynamic)
	return out

func wall(cx: float, y0: float, cz: float, w: float, h: float, d: float) -> void:
	block(cx, y0, cz, w, h, d, null)

func _merge(mesh: Mesh, mat: Material, xf: Transform3D, cast := true) -> void:
	var key := str(mat.get_instance_id()) + ("c" if cast else "n")
	if not _buckets.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_buckets[key] = { "st": st, "mat": mat, "cast": cast }
	_buckets[key].st.append_from(mesh, 0, xf)

func _flush_merged() -> void:
	for k in _buckets:
		var b: Dictionary = _buckets[k]
		var mi := MeshInstance3D.new()
		mi.mesh = b.st.commit()
		mi.material_override = b.mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if b.cast else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(mi)
	_buckets.clear()

func glow_tex() -> Texture2D:
	if _glow_tex:
		return _glow_tex
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.add_point(0.3, Color(1, 0.8, 0.5, 0.5))
	g.set_color(g.get_point_count() - 1, Color(1, 0.5, 0, 0))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5); t.fill_to = Vector2(1.0, 0.5)
	t.width = 64; t.height = 64
	_glow_tex = t
	return t

func _glow(color: Color, size: float) -> Sprite3D:
	var s := Sprite3D.new()
	s.texture = glow_tex()
	s.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	s.modulate = color
	s.pixel_size = size / 64.0
	s.shaded = false
	s.transparent = true
	s.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
	s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# brilho aditivo
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_texture = glow_tex()
	mat.albedo_color = color
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.no_depth_test = false
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	s.material_override = mat
	return s

func torch(x: float, y: float, z: float, light := true) -> void:
	var g := Node3D.new()
	g.position = Vector3(x, y, z)
	root.add_child(g)
	var stick := CylinderMesh.new()
	stick.top_radius = 0.05; stick.bottom_radius = 0.07; stick.height = 1.1; stick.radial_segments = 8
	_merge(stick, M.m.wood, Transform3D(Basis(), Vector3(x, y + 0.55, z)))
	var bowl := CylinderMesh.new()
	bowl.top_radius = 0.18; bowl.bottom_radius = 0.1; bowl.height = 0.18; bowl.radial_segments = 10
	_merge(bowl, M.m.bronze, Transform3D(Basis(), Vector3(x, y + 1.15, z)))
	var flame := MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0; cone.bottom_radius = 0.13; cone.height = 0.4; cone.radial_segments = 8
	flame.mesh = cone
	flame.material_override = M.m.flame
	flame.position.y = 1.4
	flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(flame)
	var glow := _glow(Color(1.0, 0.6, 0.25), 1.6)
	glow.position.y = 1.4
	g.add_child(glow)
	var pl: OmniLight3D = null
	if light and lights < (10 if high else 5):
		pl = OmniLight3D.new()
		pl.light_color = Color(1.0, 0.54, 0.23)
		pl.light_energy = 2.2
		pl.omni_range = 9.0
		pl.omni_attenuation = 1.6
		pl.position = Vector3(0, 1.6, 0)
		g.add_child(pl)
		lights += 1
	torches.append({ "flame": flame, "glow": glow, "pl": pl, "seed": randf() * 10.0, "base": 2.2 })

func relic(x: float, y: float, z: float) -> void:
	var g := Node3D.new()
	g.position = Vector3(x, y + 0.3, z)
	root.add_child(g)
	var base := CylinderMesh.new()
	base.top_radius = 0.16; base.bottom_radius = 0.2; base.height = 0.12
	var bodym := SphereMesh.new()
	bodym.radius = 0.16; bodym.height = 0.42
	var headm := SphereMesh.new()
	headm.radius = 0.1; headm.height = 0.2
	for p in [[base, 0.0], [bodym, 0.25], [headm, 0.5]]:
		var mi := MeshInstance3D.new()
		mi.mesh = p[0]; mi.material_override = M.m.gold; mi.position.y = p[1]
		g.add_child(mi)
	var glow := _glow(Color(1.0, 0.82, 0.38, 0.6), 1.3)
	glow.position.y = 0.3
	g.add_child(glow)
	relics.append({ "g": g, "pos": Vector3(x, y + 0.5, z), "taken": false, "base_y": y + 0.3 })
	total_relics += 1

func checkpoint(z: float, spawn: Vector3) -> void:
	checkpoints.append({ "z": z, "spawn": spawn })

func say(z: float, key: String) -> void:
	triggers.append({ "z": z, "key": key, "done": false })

# ------------------------------------------------------------------ construção
func build() -> void:
	# água
	var pm := PlaneMesh.new()
	pm.size = Vector2(600, 600)
	pm.subdivide_width = 60; pm.subdivide_depth = 60
	water = MeshInstance3D.new()
	water.mesh = pm
	water.material_override = M.m.water
	water.position = Vector3(0, -0.4, 80)
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(water)

	scenery = Scenery.new(root, M, high)
	scenery.build()

	# ===== Secção 0: acampamento =====
	block(0, -3, 6, 30, 3, 32, M.m.sand)
	wall(-11, 0, 6, 1, 10, 32); wall(11, 0, 6, 1, 10, 32); wall(0, 0, -9.5, 24, 10, 1)
	tent(-5, 0, 4, 0.4); tent(5.5, 0, 6, -0.5)
	block(-3, 0, 10, 1, 1, 1, M.m.wood); block(-2.1, 0, 10.2, 0.8, 0.8, 0.8, M.m.wood)
	block(-2.6, 1, 10.1, 0.8, 0.8, 0.8, M.m.wood)
	block(4, 0, 12, 1.2, 0.9, 0.9, M.m.wood)
	campfire(0, 0, 8)
	for b in [[-6.5, 11], [-7.2, 10.2], [7.5, 9.5]]:
		barrel(b[0], 0, b[1])
	for l in [[2.1, 0.8], [3.9, 0.8], [2.1, 1.6], [3.9, 1.6]]:
		block(l[0], 0, l[1], 0.08, 0.8, 0.08, M.m.wood, false)
	block(3, 0.8, 1.2, 2.2, 0.08, 1.1, M.m.wood, false)
	relic(-2.6, 1.8, 10.1)
	relic(7, 0, 14)
	checkpoint(-10, Vector3(0, 0, 2))

	# ===== Secção 1: escadaria =====
	for i in 8:
		block(0, 0, 22.375 + i * 0.75, 8, 0.375 * (i + 1), 0.75, M.m.stone, true, false, false)
	block(0, -3, 31, 16, 6, 6, M.m.mossStone)
	block(-6, 0, 25, 4, 3, 6, M.m.mossStone)
	block(6, 0, 25, 4, 3, 6, M.m.mossStone)
	for x in [-3.5, 3.5]:
		column(x, 3, 33.3, 7)
	block(0, 10, 33.3, 9, 1.2, 1.4, M.m.carved, false)
	torch(-5, 3, 30.5); torch(5, 3, 30.5)
	wall(-8.5, 3, 31, 1, 8, 6); wall(8.5, 3, 31, 1, 8, 6)
	relic(6, 3, 29)
	checkpoint(28.5, Vector3(0, 3, 30))
	say(26, "stairs")

	# ===== Pilares sobre a água =====
	for p in [[0, 36.3], [-0.9, 39.9], [0.7, 43.5]]:
		block(p[0], -6, p[1], 2.6, 9, 2.6, M.m.mossStone)
		block(p[0], 2.75, p[1], 2.9, 0.25, 2.9, M.m.stone, false)
		scenery.foam_ring(p[0], p[1], 1.9)
	relic(-0.9, 3, 39.9)
	wall(-8.5, -6, 40, 1, 20, 12); wall(8.5, -6, 40, 1, 20, 12)
	say(33.5, "pillars")

	# ===== Secção 2: pátio das lanças =====
	block(0, -3, 59, 16, 6, 26, M.m.stone)
	block(-7.5, 3, 59, 1, 5, 26, M.m.mossStone); block(7.5, 3, 59, 1, 5, 26, M.m.mossStone)
	var rows := [52, 55, 58]
	for r in rows.size():
		for c in 6:
			spike_plate(-5 + c * 2, 3, rows[r], r * 0.9 + (c % 2) * 0.45)
	relic(-6, 3, 48.5); relic(6, 3, 61); relic(0, 3, 56.5)
	plate(-4.5, 3, 64.5); plate(4.5, 3, 64.5)
	block(-4.75, 3, 70, 4.5, 6, 1, M.m.mossStone); block(4.75, 3, 70, 4.5, 6, 1, M.m.mossStone)
	gate = block(0, 3, 70, 5, 6, 1.1, M.m.carved, true, true)
	gate.closed_y = gate.mesh.position.y
	block(0, 9, 70, 14, 1.4, 1.6, M.m.carved, false)
	torch(-6.3, 3, 66); torch(6.3, 3, 66)
	checkpoint(47, Vector3(0, 3, 47.5))
	say(49, "spikes"); say(61, "plates")

	# ===== Secção 3: trepadeiras e abismo =====
	block(0, -3, 74.3, 16, 6, 7.6, M.m.stone)
	wall(-8.5, 3, 74, 1, 12, 8); wall(8.5, 3, 74, 1, 12, 8)
	block(0, -3, 81, 16, 12, 6, M.m.mossStone)
	climb_vines(0, 3, 77.95, 4, 6.4)
	climbs.append(Phys.Box.new(Vector3(-2.2, 3, 77.1), Vector3(2.2, 9.7, 78.2), false))
	block(-6, 9, 81, 4, 3, 6, M.m.mossStone); block(6, 9, 81, 4, 3, 6, M.m.mossStone)
	relic(2.5, 9, 82.5)
	checkpoint(79, Vector3(0, 9, 81))
	say(72, "vines")
	mover = block(0, 8.4, 87, 3, 0.6, 3, M.m.stone, true, true)
	mover.range = [87.0, 95.5]
	relic(0, 10.6, 91.5)
	block(0, -3, 101, 12, 12, 6, M.m.mossStone)
	wall(-6.5, 9, 92, 1, 10, 24); wall(6.5, 9, 92, 1, 10, 24)
	torch(-4.5, 9, 99.5); torch(4.5, 9, 99.5)
	checkpoint(98.5, Vector3(0, 9, 100))
	say(83, "bridge")

	# ===== Secção 4: corredor da pedra rolante =====
	block(0, -3, 107, 6, 12, 6, M.m.stone)
	for i in 20:
		var z0 := 110 + i * 1.5
		var top := 9 - i * 0.3
		block(0, -3, z0 + 0.75, 6, top + 3, 1.5, M.m.stone, true, false, false)
	block(0, -3, 140.5, 6, 6, 1, M.m.stone)
	for s in [-1, 1]:
		var z := 104
		while z < 141:
			var top := floor_at(z + 6)
			block(s * 3.5, top, z + 3, 1, 4 + (floor_at(z) - top), 6, M.m.mossStone)
			z += 6
	torch(-2.5, 9, 105); torch(2.5, 9, 105)
	torch(-2.5, 6, 125, false); torch(2.5, 4.5, 133, false)
	relic(-2, 7.8, 117); relic(2, 4.5, 132)
	boulder = make_boulder()
	checkpoint(104.5, Vector3(0, 9, 105))
	say(108.5, "boulder")

	# ===== Secção 5: câmara do altar =====
	block(0, -3, 156, 22, 6, 24.8, M.m.stone)
	block(-11.5, 3, 156, 1, 9, 25, M.m.mossStone); block(11.5, 3, 156, 1, 9, 25, M.m.mossStone)
	block(0, 3, 168.5, 24, 9, 1, M.m.mossStone)
	block(-7.5, 3, 143.6, 7, 9, 1, M.m.mossStone); block(7.5, 3, 143.6, 7, 9, 1, M.m.mossStone)
	block(0, 12, 156, 24, 1, 6, M.m.stone, false)
	block(0, 12, 146, 24, 1, 3, M.m.stone, false)
	block(0, -12, 142.3, 6, 6, 2.6, M.m.stone, true, false, false)
	for z in [148, 154, 160]:
		for x in [-7, 7]:
			column(x, 3, z, 9)
	block(0, 3, 160, 4, 0.4, 4, M.m.mossStone)
	block(0, 3.4, 160, 3, 0.4, 3, M.m.mossStone)
	block(0, 3.8, 160, 1.2, 1, 1.2, M.m.stone)
	astrolabe = make_astrolabe()
	astrolabe.position = altar_pos
	torch(-4, 3, 150); torch(4, 3, 150); torch(-4, 3, 164); torch(4, 3, 164)
	relic(-9, 3, 165)
	checkpoint(144, Vector3(0, 3, 145.5))
	say(150, "altar")
	decorate()
	_flush_merged()

func floor_at(z: float) -> float:
	if z < 110: return 9.0
	if z >= 140: return 3.0
	return 9.0 - floor((z - 110) / 1.5) * 0.3

func decorate() -> void:
	var r := RandomNumberGenerator.new()
	r.seed = 99
	var vines: Array = []
	var hang := func(x, ytop, z0, z1, rot, n, maxlen):
		for i in n:
			vines.append([x, ytop + 0.05, z0 + r.randf() * (z1 - z0), 1 + r.randf() * maxlen, rot])
	hang.call(-6.94, 8, 46.5, 69, PI / 2, 14, 3.5)
	hang.call(6.94, 8, 46.5, 69, -PI / 2, 14, 3.5)
	hang.call(-5.95, 6, 22, 28, PI / 2, 5, 2.5)
	hang.call(5.95, 6, 22, 28, -PI / 2, 5, 2.5)
	for i in 12:
		var z := 105 + r.randf() * 34
		var top := floor_at(z) + 4
		var side := 1 if i % 2 else -1
		vines.append([side * 2.94, top, z, 1 + r.randf() * 2.2, -PI / 2 if side > 0 else PI / 2])
	hang.call(-10.94, 12, 145, 167, PI / 2, 12, 5)
	hang.call(10.94, 12, 145, 167, -PI / 2, 12, 5)
	for i in 8:
		vines.append([-10 + r.randf() * 20, 12, 167.94, 1 + r.randf() * 5, PI])
	scenery.hanging_vines(vines)

	var rub: Array = []
	var pile := func(x, y, z, n, spread, sc):
		for i in n:
			rub.append([x + (r.randf() - 0.5) * spread, y, z + (r.randf() - 0.5) * spread, sc * (0.4 + r.randf())])
	pile.call(-6.3, 3, 47.5, 4, 1.2, 0.3); pile.call(6.3, 3, 68.5, 4, 1.2, 0.3)
	pile.call(-10.2, 3, 146, 5, 1.6, 0.35); pile.call(10.2, 3, 166.5, 5, 1.6, 0.35); pile.call(-10, 3, 158, 3, 1, 0.3)
	pile.call(-9, 0, -6, 6, 3, 0.4); pile.call(9, 0, 18, 5, 3, 0.4)
	scenery.rubble(rub)

	for s in [[-5.2, 3, 33.5, 0.0], [5.2, 3, 33.5, 0.0], [-9.8, 3, 162, PI / 2], [9.8, 3, 162, -PI / 2]]:
		statue(s[0], s[1], s[2], s[3])
	var fallen := CylinderMesh.new()
	fallen.top_radius = 0.5; fallen.bottom_radius = 0.55; fallen.height = 4; fallen.radial_segments = 12
	_merge(fallen, M.m.mossStone, Transform3D(Basis.from_euler(Vector3(0, 0.4, PI / 2)), Vector3(-5.6, 3.5, 67.5)))

func statue(x: float, y: float, z: float, ry: float) -> void:
	var b := Basis(Vector3.UP, ry)
	var base := Vector3(x, y, z)
	var bm := BoxMesh.new(); bm.size = Vector3(1.3, 0.5, 1.3)
	_merge(bm, M.m.stone, Transform3D(b, base + Vector3(0, 0.25, 0)))
	var bm2 := BoxMesh.new(); bm2.size = Vector3(1.05, 0.25, 1.05)
	_merge(bm2, M.m.mossStone, Transform3D(b, base + Vector3(0, 0.62, 0)))
	var shaft := CylinderMesh.new()
	shaft.top_radius = 0.36; shaft.bottom_radius = 0.44; shaft.height = 3.0; shaft.radial_segments = 4
	_merge(shaft, M.m.carved, Transform3D(b * Basis(Vector3.UP, PI / 4), base + Vector3(0, 2.25, 0)))
	var cap := CylinderMesh.new()
	cap.top_radius = 0.0; cap.bottom_radius = 0.47; cap.height = 0.6; cap.radial_segments = 4
	_merge(cap, M.m.stone, Transform3D(b * Basis(Vector3.UP, PI / 4), base + Vector3(0, 4.05, 0)))
	world.add(Phys.Box.center(Vector3(x, y + 1.5, z), Vector3(1.3, 3, 1.3)))

func barrel(x: float, y: float, z: float) -> void:
	var cm := CylinderMesh.new()
	cm.top_radius = 0.38; cm.bottom_radius = 0.38; cm.height = 1.0; cm.radial_segments = 14
	_merge(cm, M.m.wood, Transform3D(Basis(), Vector3(x, y + 0.5, z)))
	for h in [0.15, 0.85]:
		var tm := TorusMesh.new()
		tm.inner_radius = 0.37; tm.outer_radius = 0.41; tm.rings = 18; tm.ring_segments = 4
		_merge(tm, M.m.spike, Transform3D(Basis(), Vector3(x, y + h, z)))
	world.add(Phys.Box.center(Vector3(x, y + 0.5, z), Vector3(0.76, 1, 0.76)))

func column(x: float, y0: float, z: float, h: float) -> void:
	block(x, y0, z, 1.4, 0.4, 1.4, M.m.stone)
	var cm := CylinderMesh.new()
	cm.top_radius = 0.5; cm.bottom_radius = 0.55; cm.height = h - 0.8; cm.radial_segments = 14
	_merge(cm, M.m.mossStone, Transform3D(Basis(), Vector3(x, y0 + 0.4 + (h - 0.8) / 2, z)))
	world.add(Phys.Box.center(Vector3(x, y0 + h / 2, z), Vector3(1, h, 1)))
	block(x, y0 + h - 0.4, z, 1.4, 0.4, 1.4, M.m.stone, false)

func tent(x: float, y: float, z: float, rot: float) -> void:
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0; cm.bottom_radius = 1.8; cm.height = 2.2; cm.radial_segments = 4; cm.cap_bottom = false
	_merge(cm, M.m.canvas, Transform3D(Basis(Vector3.UP, rot + PI / 4), Vector3(x, y + 1.1, z)))
	world.add(Phys.Box.center(Vector3(x, y + 0.8, z), Vector3(2.2, 1.6, 2.2)))

func campfire(x: float, y: float, z: float) -> void:
	for i in 7:
		var a := float(i) / 7 * TAU
		var sm := SphereMesh.new(); sm.radius = 0.18; sm.height = 0.3; sm.radial_segments = 6; sm.rings = 3
		_merge(sm, M.m.rock, Transform3D(Basis(), Vector3(x + cos(a) * 0.5, y + 0.1, z + sin(a) * 0.5)))
	var flame := MeshInstance3D.new()
	var cone := CylinderMesh.new(); cone.top_radius = 0.0; cone.bottom_radius = 0.3; cone.height = 0.8
	flame.mesh = cone; flame.material_override = M.m.flame
	flame.position = Vector3(x, y + 0.4, z)
	root.add_child(flame)
	var pl := OmniLight3D.new()
	pl.light_color = Color(1.0, 0.48, 0.16); pl.light_energy = 3.0; pl.omni_range = 12; pl.omni_attenuation = 1.5
	pl.position = Vector3(x, y + 1, z)
	root.add_child(pl)
	lights += 1
	torches.append({ "flame": flame, "glow": null, "pl": pl, "seed": 3.0, "base": 3.0 })

func _spikes_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0; cone.bottom_radius = 0.09; cone.height = 0.8; cone.radial_segments = 6
	for i in 4:
		for j in 4:
			st.append_from(cone, 0, Transform3D(Basis(), Vector3(-0.7 + i * 0.47, 0.4, -0.7 + j * 0.47)))
	return st.commit()

var _spm: ArrayMesh
func spike_plate(x: float, y: float, z: float, offset: float) -> void:
	var bm := BoxMesh.new(); bm.size = Vector3(1.9, 0.06, 1.9)
	_merge(bm, M.m.stone, Transform3D(Basis(), Vector3(x, y + 0.03, z)), false)
	if _spm == null:
		_spm = _spikes_mesh()
	var mi := MeshInstance3D.new()
	mi.mesh = _spm
	mi.material_override = M.m.spike
	mi.position = Vector3(x, y - 0.85, z)
	root.add_child(mi)
	spikes.append({ "n": mi, "x": x, "y": y, "z": z, "offset": offset, "up": false, "h": -0.85 })

func plate(x: float, y: float, z: float) -> void:
	var mat: StandardMaterial3D = M.m.plate.duplicate()
	mat.emission_enabled = true
	mat.emission = Color.BLACK
	var cm := CylinderMesh.new(); cm.top_radius = 1.0; cm.bottom_radius = 1.05; cm.height = 0.15; cm.radial_segments = 24
	var mi := MeshInstance3D.new()
	mi.mesh = cm; mi.material_override = mat
	mi.position = Vector3(x, y + 0.075, z)
	root.add_child(mi)
	var tm := TorusMesh.new(); tm.inner_radius = 0.5; tm.outer_radius = 0.6; tm.rings = 24; tm.ring_segments = 6
	_merge(tm, M.m.bronze, Transform3D(Basis().scaled(Vector3(1, 0.5, 1)), Vector3(x, y + 0.17, z)))
	plates.append({ "m": mi, "mat": mat, "x": x, "z": z, "y": y, "pressed": false })

func climb_vines(cx: float, y0: float, z: float, w: float, h: float) -> void:
	var list: Array = []
	for i in 18:
		list.append([cx - w / 2 + (i / 17.0) * w, y0 + h + 0.2, z - 0.06, h, PI])
	scenery.hanging_vines(list)
	# folhas extra por cima
	var leaves := scenery._cards_mesh(2, 0.5, 0.9, M.m.leaves)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = leaves
	mm.instance_count = 40
	var r := RandomNumberGenerator.new(); r.seed = 3
	for i in 40:
		var p := Vector3(cx - w / 2 - 0.4 + r.randf() * (w + 0.8), y0 + r.randf() * (h + 0.3) - 0.4, z - 0.2)
		mm.set_instance_transform(i, Transform3D(Basis.from_euler(Vector3(r.randf_range(-0.4, 0.4), r.randf() * TAU, r.randf_range(-0.4, 0.4))), p))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	root.add_child(mmi)

func make_boulder() -> Dictionary:
	var sm := SphereMesh.new()
	sm.radius = 2.3; sm.height = 4.6; sm.radial_segments = 20; sm.rings = 12
	var arr := sm.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	for i in v.size():
		var p := v[i]
		v[i] = p * (1.0 + sin(p.x * 3) * cos(p.y * 2.7) * 0.06)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = null
	arr[Mesh.ARRAY_TANGENT] = null
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var st := SurfaceTool.new(); st.create_from(am, 0); st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = M.m.mossStone
	mi.visible = false
	root.add_child(mi)
	return { "mesh": mi, "r": 2.3, "active": false, "z": 0.0, "y": 0.0, "vy": 0.0, "speed": 0.0, "falling": false, "armed": true }

func make_astrolabe() -> Node3D:
	var g := Node3D.new()
	root.add_child(g)
	var ring := MeshInstance3D.new()
	var t1 := TorusMesh.new(); t1.inner_radius = 0.49; t1.outer_radius = 0.61; t1.rings = 40; t1.ring_segments = 10
	ring.mesh = t1; ring.material_override = M.m.bronze; ring.rotation.x = PI / 2
	var ring2 := MeshInstance3D.new()
	var t2 := TorusMesh.new(); t2.inner_radius = 0.38; t2.outer_radius = 0.46; t2.rings = 36; t2.ring_segments = 8
	ring2.mesh = t2; ring2.material_override = M.m.gold; ring2.rotation.z = PI / 2
	var core := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.22; sm.height = 0.44; sm.radial_segments = 8; sm.rings = 5
	core.mesh = sm; core.material_override = M.m.amber
	g.add_child(ring); g.add_child(ring2); g.add_child(core)
	var pl := OmniLight3D.new()
	pl.light_color = Color(1.0, 0.63, 0.19); pl.light_energy = 4.0; pl.omni_range = 14
	g.add_child(pl)
	var beam := MeshInstance3D.new()
	var cm := CylinderMesh.new(); cm.top_radius = 0.6; cm.bottom_radius = 2.4; cm.height = 14; cm.cap_top = false; cm.cap_bottom = false
	var bmat := StandardMaterial3D.new()
	bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bmat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	bmat.albedo_color = Color(1.0, 0.82, 0.54, 0.06)
	bmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	bmat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	beam.mesh = cm; beam.material_override = bmat
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam.position.y = 5
	g.add_child(beam)
	g.set_meta("parts", [ring, ring2, core])
	return g

# ------------------------------------------------------------------ lógica por frame
func update(dt: float, game) -> void:
	time += dt
	var t := time
	scenery.update(t)
	for tc in torches:
		var f := 0.85 + sin(t * 13 + tc.seed) * 0.08 + sin(t * 29 + tc.seed * 2) * 0.07
		tc.flame.scale = Vector3(1, f, 1)
		if tc.pl:
			tc.pl.light_energy = tc.base * f
	for r in relics:
		if r.taken:
			continue
		r.g.rotation.y += dt * 1.8
		r.g.position.y = r.base_y + sin(t * 2.5 + r.pos.x) * 0.12

	for sp in spikes:
		var c := fmod(t + sp.offset, 2.7) / 2.7
		var target := 0.0 if (c > 0.55 and c < 0.92) else -0.85
		sp.h += (target - sp.h) * minf(1.0, dt * (30.0 if target == 0.0 else 6.0))
		sp.up = sp.h > -0.35
		sp.n.position.y = sp.y + sp.h

	var pressed := 0
	for pl in plates:
		pl.pressed = false
		for p in game.players:
			if not p.dead and Vector2(p.pos.x - pl.x, p.pos.z - pl.z).length() < 1.05 and absf(p.pos.y - pl.y) < 0.5:
				pl.pressed = true
		pl.mat.emission = Color(0.42, 0.29, 0.0) if pl.pressed else Color.BLACK
		pl.m.position.y = pl.y + (0.02 if pl.pressed else 0.075)
		if pl.pressed:
			pressed += 1
	var need := mini(2, maxi(1, game.players.size()))
	var open := pressed >= need or gate_latched
	if pressed >= need and not gate_latched:
		gate_latched = true
		game.sfx("gate")
	var gm: MeshInstance3D = gate.mesh
	var target_y: float = gate.closed_y - 6.2 if open else gate.closed_y
	var ny := move_toward(gm.position.y, target_y, dt * 2.2)
	gate.col.move_by(Vector3(0, ny - gm.position.y, 0))
	gm.position.y = ny

	var a: float = mover.range[0]
	var b: float = mover.range[1]
	var mz := a + (b - a) * (0.5 - 0.5 * cos(t * 0.75))
	var mm: MeshInstance3D = mover.mesh
	mover.col.move_by(Vector3(0, 0, mz - mm.position.z))
	mm.position.z = mz

	if not astrolabe_taken:
		var parts: Array = astrolabe.get_meta("parts")
		parts[0].rotation.y += dt * 0.8
		parts[1].rotation.x += dt * 1.1
		parts[2].rotation.y -= dt
		astrolabe.position.y = altar_pos.y + sin(t * 1.5) * 0.1
	update_boulder(dt, game)

func update_boulder(dt: float, game) -> void:
	var B := boulder
	if not B.active:
		if B.armed:
			for p in game.players:
				if not p.dead and p.pos.z > 108.5 and p.pos.z < 140 and p.pos.y > 2:
					B.active = true; B.armed = false; B.z = 101.5; B.y = 14.0; B.vy = 0.0; B.speed = 3.5; B.falling = false
					B.mesh.visible = true
					game.sfx("rumble"); game.shake(0.6)
					break
		return
	B.speed = minf(7.2, B.speed + dt * 2.2)
	B.z += B.speed * dt
	var fl := floor_at(B.z) if (B.z < 141 or B.z > 143.6) else -20.0
	var rest_y := -6.0 if (B.z >= 141 and B.z <= 143.6 + B.r) else fl
	B.vy -= 26 * dt
	B.y += B.vy * dt
	if B.y - B.r < rest_y and rest_y > -10:
		if B.vy < -6:
			game.shake(0.35)
		B.y = rest_y + B.r; B.vy = 0.0
	if B.z > 141.6:
		B.z = minf(B.z, 142.3); B.falling = true
	if B.falling and B.y < -2:
		B.active = false; B.mesh.visible = false; B.armed = true
		game.shake(0.8)
		return
	B.mesh.position = Vector3(0, B.y, B.z)
	B.mesh.rotation.x += (B.speed * dt) / B.r
	for p in game.players:
		if p.dead:
			continue
		var dy: float = (p.pos.y + 0.9) - B.y
		var dz: float = p.pos.z - B.z
		if absf(p.pos.x) < 2.6 and Vector2(dy, dz).length() < B.r + 0.35:
			game.kill(p, "esmagado")

func hazard_at(p) -> bool:
	for sp in spikes:
		if sp.up and absf(p.pos.x - sp.x) < 0.95 and absf(p.pos.z - sp.z) < 0.95 and p.pos.y < sp.y + 0.6:
			return true
	return false

func climb_at(p) -> bool:
	for c in climbs:
		if world.body_in(p, c):
			return true
	return false

func checkpoint_for(max_z: float) -> Dictionary:
	var best: Dictionary = checkpoints[0]
	for c in checkpoints:
		if max_z >= c.z and c.z >= best.z:
			best = c
	return best
