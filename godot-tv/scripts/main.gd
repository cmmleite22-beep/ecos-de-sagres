# Ecos de Sagres — núcleo do jogo na TV (Godot). Mesma lógica da versão web:
# primeira pessoa, ecrã dividido de 1 a 4 jogadores, telemóveis como comandos.
extends Node3D

const WALK := 4.6
const SPRINT := 7.4
const JUMP_V := 9.2
const CLIMB_V := 3.4
const EYE := 1.62
const MAX_HP := 100.0
const REGEN_DELAY := 4.0
const REGEN_RATE := 14.0
const AIM_ASSIST := 0.16
const AIM_SNAP := 0.1
const FIRE_COOLDOWN := 0.22
const LOOK_SENS := 0.0042
const STICK_LOOK := 2.6
const BTN_JUMP := 1
const BTN_SPRINT := 2
const BTN_ACTION := 4
const BTN_FIRE := 8
const CHARS := [
	{ "id": "ana", "name": "Ana Varela", "color": "#e0a040" },
	{ "id": "tito", "name": "Tito Brandão", "color": "#3fa7d6" },
	{ "id": "ines", "name": "Inês Kwan", "color": "#d6457a" },
	{ "id": "rafa", "name": "Rafa Okoro", "color": "#59c26b" },
]

class Player:
	var id := ""
	var name := ""
	var ch := {}
	var color := Color.WHITE
	var pos := Vector3.ZERO
	var vel := Vector3.ZERO
	var radius := 0.33
	var height := 1.75
	var yaw := 0.0
	var pitch := 0.0
	var look_dx := 0.0
	var look_dy := 0.0
	var sens := 1.0
	var on_ground := false
	var ground = null
	var hit_wall := false
	var coyote := 0.0
	var jump_buf := 0.0
	var prev_b := 0
	var input := { "x": 0.0, "y": 0.0, "b": 0, "rx": 0.0, "ry": 0.0 }
	var hp := 100.0
	var since_hurt := 99.0
	var relics := 0
	var kills := 0
	var dead := false
	var dead_t := 0.0
	var hurt := 0.0
	var fire_cool := 0.0
	var recoil := 0.0
	var bob := 0.0
	var climbing := false
	var firing := false
	var looking := false
	var model: CharModel
	var cam: Camera3D
	var view: Node3D
	var flash: MeshInstance3D
	var vp: SubViewport

var players: Array = []
var phase := "lobby"
var cp_z := -10.0
var relics_found := 0
var relics_total := 0
var shake_amt := 0.0
var elapsed := 0.0
var auto_aim := true
var high := true
var render_scale := 1.0

var world: Phys
var M: Mats
var level: Level1
var enemies: Enemies
var net: Net
var sfx_node: Sfx
var hud: Hud
var sun: DirectionalLight3D
var env: Environment
var views_root: Control
var over_vp: SubViewport
var over_cam: Camera3D
var over_target := Vector3(0, 2, 10)
var dialog_queue: Array = []
var dialog_t := 0.0
var dialog_busy := false
var fx: Array = []
var hud_dirty := false
var _t := 0.0
var kb_on := false

func _ready() -> void:
	var mobile := OS.has_feature("mobile") or OS.has_feature("android")
	high = not mobile
	render_scale = 0.8 if mobile else 1.0
	Engine.physics_ticks_per_second = 60 if mobile else 120
	for a in OS.get_cmdline_user_args():
		if a == "--low": high = false
		if a == "--no-autoaim": auto_aim = false
	get_viewport().disable_3d = true   # cada vista tem a sua SubViewport
	_setup_environment()
	M = Mats.new()
	world = Phys.new()
	level = Level1.new(self, world, M, high)
	enemies = Enemies.new(self, world, Level1.ENEMY_SPOTS)
	relics_total = level.total_relics

	views_root = Control.new()
	views_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	views_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(views_root)
	over_vp = _make_vp()
	over_cam = Camera3D.new()
	over_cam.fov = 50
	over_cam.far = 700
	over_cam.cull_mask = 1 | 0b11110
	over_vp.add_child(over_cam)

	sfx_node = Sfx.new()
	add_child(sfx_node)
	hud = Hud.new()
	add_child(hud)
	net = Net.new()
	add_child(net)
	net.player_joined.connect(add_player)
	net.player_left.connect(remove_player)
	net.message.connect(_on_msg)
	hud.set_room(net.room, net.controller_url())
	hud.set_relics(0, relics_total)
	hud.set_players([])
	get_viewport().size_changed.connect(relayout)
	relayout()

func _make_vp() -> SubViewport:
	var vp := SubViewport.new()
	vp.msaa_3d = Viewport.MSAA_2X if high else Viewport.MSAA_DISABLED
	vp.scaling_3d_scale = render_scale
	vp.positional_shadow_atlas_size = 0
	vp.audio_listener_enable_3d = false
	return vp

func _setup_environment() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.36, 0.55, 0.78)
	sm.sky_energy_multiplier = 0.9
	sm.sky_horizon_color = Color(0.72, 0.8, 0.82)
	sm.ground_horizon_color = Color(0.6, 0.66, 0.62)
	sm.ground_bottom_color = Color(0.2, 0.24, 0.18)
	sm.sun_angle_max = 30.0
	sm.sun_curve = 0.12
	sky.sky_material = sm
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.45
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.95
	env.tonemap_white = 6.0
	env.glow_enabled = high
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.glow_hdr_threshold = 1.2
	env.fog_enabled = true
	env.fog_light_color = Color(0.66, 0.74, 0.76)
	env.fog_density = 0.006 if high else 0.008
	env.fog_sky_affect = 0.25
	env.fog_aerial_perspective = 0.4
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.05
	env.adjustment_contrast = 1.05
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.94, 0.84)
	sun.light_energy = 2.1
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 70.0 if high else 45.0
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.2
	sun.rotation = Vector3(deg_to_rad(-38), deg_to_rad(150), 0)
	add_child(sun)

# ------------------------------------------------------------------ vistas
static func layout_for(n: int) -> Array:
	if n <= 1:
		return [Rect2(0, 0, 1, 1)]
	if n == 2:
		return [Rect2(0, 0, 0.5, 1), Rect2(0.5, 0, 0.5, 1)]
	return [Rect2(0, 0, 0.5, 0.5), Rect2(0.5, 0, 0.5, 0.5), Rect2(0, 0.5, 0.5, 0.5), Rect2(0.5, 0.5, 0.5, 0.5)]

func relayout() -> void:
	var screen := get_viewport().get_visible_rect().size
	for c in views_root.get_children():
		for vp in c.get_children():
			c.remove_child(vp)
		c.queue_free()
	var n := players.size() if phase != "lobby" else 0
	var rects := layout_for(n)
	for i in rects.size():
		var r: Rect2 = rects[i]
		var cont := SubViewportContainer.new()
		cont.stretch = true
		cont.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cont.position = r.position * screen
		cont.size = r.size * screen
		views_root.add_child(cont)
		var vp: SubViewport = players[i].vp if i < n else over_vp
		cont.add_child(vp)
	var vp_players := players if phase != "lobby" else []
	hud.layout(rects, vp_players, screen)

# ------------------------------------------------------------------ jogadores
func _char_by_id(id: String) -> Dictionary:
	for c in CHARS:
		if c.id == id:
			return c
	return {}

func free_char(pref: String, except = null) -> Dictionary:
	var used := {}
	for p in players:
		if p != except:
			used[p.ch.id] = true
	for c in CHARS:
		if c.id == pref and not used.has(c.id):
			return c
	for c in CHARS:
		if not used.has(c.id):
			return c
	return CHARS[0]

func _make_body(p: Player) -> void:
	var idx := CHARS.find(p.ch)
	p.color = Color(p.ch.color)
	p.model = CharModel.new(p.color, idx)
	p.model.add_tag(p.name, p.color)
	add_child(p.model.root)
	p.view = _build_view_model(p.color)
	p.cam.add_child(p.view)

func add_player(id: String, pname: String, char_id: String) -> void:
	var known := _find(id)
	if known:
		_welcome(known)
		return
	if players.size() >= 4:
		net.send(id, { "t": "error", "reason": "Sala cheia" })
		return
	var p := Player.new()
	p.id = id
	p.ch = free_char(char_id)
	p.name = pname if pname != "" else p.ch.name.split(" ")[0]
	p.vp = _make_vp()
	p.cam = Camera3D.new()
	p.cam.fov = 72
	p.cam.near = 0.05
	p.cam.far = 700
	p.vp.add_child(p.cam)
	_make_body(p)
	players.append(p)
	assign_layers()
	respawn(p)
	sfx_node.play("join")
	_welcome(p)
	relayout()
	sync_lobby()
	send_state(p)

func _welcome(p: Player) -> void:
	net.send(p.id, { "t": "welcome", "id": p.id, "char": p.ch.id, "color": p.ch.color, "name": p.name })
	sync_lobby()
	send_state(p)

func _find(id: String) -> Player:
	for p in players:
		if p.id == id:
			return p
	return null

func assign_layers() -> void:
	for i in players.size():
		var p: Player = players[i]
		p.model.set_layer(1 << (1 + i))
		_set_layers(p.view, 1 << (5 + i))
		var mask := 1 | (1 << (5 + i))
		for j in 4:
			if j != i:
				mask |= 1 << (1 + j)
		p.cam.cull_mask = mask

func _set_layers(n: Node, mask: int) -> void:
	if n is VisualInstance3D:
		n.layers = mask
	for c in n.get_children():
		_set_layers(c, mask)

func set_char(p: Player, char_id: String) -> void:
	var c := free_char(char_id, p)
	if c == p.ch:
		return
	p.model.root.queue_free()
	p.view.queue_free()
	p.ch = c
	_make_body(p)
	assign_layers()
	net.send(p.id, { "t": "welcome", "id": p.id, "char": c.id, "color": c.color, "name": p.name })
	relayout()
	sync_lobby()

func remove_player(id: String) -> void:
	var p := _find(id)
	if p == null:
		return
	p.model.root.queue_free()
	players.erase(p)
	assign_layers()
	relayout()
	p.vp.queue_free()
	sync_lobby()

func _on_msg(id: String, m: Dictionary) -> void:
	var p := _find(id)
	match str(m.get("t", "")):
		"join":
			if p:
				if m.has("name") and str(m.name) != "":
					p.name = str(m.name).substr(0, 14)
				_welcome(p)
		"in":
			if p == null:
				return
			p.input.x = clampf(float(m.get("x", 0)), -1, 1)
			p.input.y = clampf(float(m.get("y", 0)), -1, 1)
			p.input.b = int(m.get("b", 0))
			p.look_dx += clampf(float(m.get("lx", 0)), -400, 400)
			p.look_dy += clampf(float(m.get("ly", 0)), -400, 400)
			p.input.rx = clampf(float(m.get("rx", 0)), -1, 1)
			p.input.ry = clampf(float(m.get("ry", 0)), -1, 1)
			if m.has("sens"):
				p.sens = clampf(float(m.sens), 0.3, 3.0)
		"start":
			if phase == "win":
				restart()
			else:
				start_game()
		"char":
			if p and phase == "lobby":
				set_char(p, str(m.get("char", "")))
		"ping":
			net.send(id, { "t": "pong", "ts": m.get("ts", 0) })

func _build_view_model(color: Color) -> Node3D:
	var g := Node3D.new()
	var metal := CharModel._mat(Color(0.32, 0.33, 0.35), 0.38); metal.metallic = 0.75
	var worn := CharModel._mat(Color(0.55, 0.56, 0.58), 0.3); worn.metallic = 0.85
	var grip := CharModel._mat(Color(0.23, 0.16, 0.11), 0.75)
	var sleeve := CharModel._mat(color, 0.85)
	var glove := CharModel._mat(Color(0.35, 0.25, 0.19), 0.7)
	var add := func(mesh: Mesh, mat: Material, p: Vector3, r := Vector3.ZERO):
		var mi := MeshInstance3D.new()
		mi.mesh = mesh; mi.material_override = mat; mi.position = p; mi.rotation = r
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
		return mi
	var box := func(x, y, z):
		var b := BoxMesh.new(); b.size = Vector3(x, y, z); return b
	add.call(box.call(0.05, 0.05, 0.27), metal, Vector3(0, 0.036, -0.085))
	for i in 6:
		add.call(box.call(0.052, 0.04, 0.004), worn, Vector3(0, 0.036, 0.02 + i * 0.008))
	add.call(box.call(0.046, 0.03, 0.22), metal, Vector3(0, -0.002, -0.07))
	var barrel := CylinderMesh.new(); barrel.top_radius = 0.011; barrel.bottom_radius = 0.011; barrel.height = 0.03
	add.call(barrel, worn, Vector3(0, 0.04, -0.225), Vector3(PI / 2, 0, 0))
	add.call(box.call(0.008, 0.012, 0.012), worn, Vector3(0, 0.066, -0.2))
	add.call(box.call(0.02, 0.01, 0.01), worn, Vector3(0, 0.065, 0.035))
	add.call(box.call(0.044, 0.13, 0.055), grip, Vector3(0, -0.07, 0.03), Vector3(0.22, 0, 0))
	add.call(box.call(0.06, 0.085, 0.07), glove, Vector3(0.004, -0.065, 0.045), Vector3(0.22, 0, 0))
	var arm := CylinderMesh.new(); arm.top_radius = 0.052; arm.bottom_radius = 0.065; arm.height = 0.45
	add.call(arm, sleeve, Vector3(0.02, -0.15, 0.36), Vector3(PI / 2 - 0.3, 0, 0))
	var flash := MeshInstance3D.new()
	var cone := CylinderMesh.new(); cone.top_radius = 0.0; cone.bottom_radius = 0.05; cone.height = 0.16
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.albedo_color = Color(1, 0.82, 0.5)
	flash.mesh = cone; flash.material_override = fm
	flash.rotation.x = -PI / 2
	flash.position = Vector3(0, 0.04, -0.32)
	flash.visible = false
	g.add_child(flash)
	g.position = Vector3(0.19, -0.17, -0.4)
	g.scale = Vector3.ONE * 0.85
	g.set_meta("flash", flash)
	g.set_meta("base", g.position)
	return g

func sync_lobby() -> void:
	var list := []
	for p in players:
		list.append({ "id": p.id, "name": p.name, "char": p.ch.id, "color": p.ch.color, "hp": int(ceil(p.hp)), "relics": p.relics, "kills": p.kills, "dead": p.dead })
	hud.set_players(list)
	net.send("", { "t": "lobby", "players": list, "phase": phase })

func send_state(p: Player) -> void:
	net.send(p.id, { "t": "state", "hp": int(ceil(p.hp)), "max": int(MAX_HP), "relics": p.relics, "kills": p.kills, "team": relics_found, "total": relics_total, "phase": phase })

func start_game() -> void:
	if phase != "lobby" or players.is_empty():
		return
	phase = "play"
	hud.show_lobby(false)
	hud.toast("CAPÍTULO 1 — O TEMPLO DAS MARÉS", 3.5)
	queue_lines("intro")
	relayout()
	for p in players:
		send_state(p)
	sync_lobby()

# ------------------------------------------------------------------ regras
func respawn(p: Player) -> void:
	var cp := level.checkpoint_for(cp_z)
	var i := players.find(p)
	p.pos = cp.spawn + Vector3((i - 1.5) * 1.1, 0.05, 0)
	p.vel = Vector3.ZERO
	p.yaw = 0.0
	p.pitch = -0.05
	p.dead = false
	p.hp = MAX_HP
	p.hurt = 1.0
	p.ground = null
	p.on_ground = false
	p.model.root.visible = true
	p.view.visible = true
	p.model.root.position = p.pos

func damage(p: Player, amt: float, from = null) -> void:
	if p.dead or p.hurt > 0.0:
		return
	p.hp -= amt
	p.since_hurt = 0.0
	if amt >= 25:
		p.hurt = 0.8
	sfx_node.play("hurt")
	net.send(p.id, { "t": "buzz", "ms": 160 if amt >= 25 else 70 })
	hud.hurt(players.find(p), dir_to(p, from) if from != null else null)
	if p.hp <= 0:
		kill(p, "ferido")
	else:
		send_state(p)
	hud_dirty = true

func dir_to(p: Player, from: Vector3) -> float:
	var a := atan2(from.x - p.pos.x, from.z - p.pos.z)
	return wrapf(a - p.yaw, -PI, PI)

func kill(p: Player, why: String) -> void:
	if p.dead:
		return
	p.dead = true
	p.dead_t = 2.5
	p.hp = 0
	p.model.root.visible = false
	p.view.visible = false
	sfx_node.play("die")
	net.send(p.id, { "t": "buzz", "ms": 400 })
	var msg: String = { "caiu": "caiu", "esmagado": "foi esmagado(a)!", "ferido": "foi abatido(a)!" }.get(why, "caiu")
	hud.toast("%s %s" % [p.name, msg], 1.6)
	send_state(p)
	sync_lobby()

func shake(a: float) -> void:
	shake_amt = maxf(shake_amt, a)

func sfx(n: String) -> void:
	sfx_node.play(n)

func queue_lines(key: String) -> void:
	for l in Level1.LINES.get(key, []):
		dialog_queue.append(l)
	if not dialog_busy:
		_next_line()

func _next_line() -> void:
	if dialog_queue.is_empty():
		dialog_busy = false
		hud.dialog("")
		return
	var l: Array = dialog_queue.pop_front()
	dialog_busy = true
	var color := Color.WHITE
	for c in CHARS:
		if c.name.begins_with(l[0]):
			color = Color(c.color)
	hud.dialog(l[0], l[1], color)
	dialog_t = 1.8 + l[1].length() * 0.045

func win() -> void:
	if phase != "play":
		return
	phase = "win"
	level.astrolabe_taken = true
	level.astrolabe.visible = false
	sfx_node.play("win")
	queue_lines("win")
	for p in players:
		net.send(p.id, { "t": "buzz", "ms": 300 })
		send_state(p)
	get_tree().create_timer(2.5).timeout.connect(func():
		var list := []
		for p in players:
			list.append({ "name": p.name, "color": p.color, "relics": p.relics, "kills": p.kills })
		hud.show_win(list, relics_found, relics_total, elapsed))

func restart() -> void:
	if phase != "win":
		return
	level.root.queue_free()
	enemies.root.queue_free()
	world = Phys.new()
	level = Level1.new(self, world, M, high)
	enemies = Enemies.new(self, world, Level1.ENEMY_SPOTS)
	relics_total = level.total_relics
	relics_found = 0
	cp_z = -10.0
	elapsed = 0.0
	dialog_queue.clear()
	hud.dialog("")
	hud.hide_win()
	hud.set_relics(0, relics_total)
	for p in players:
		p.relics = 0; p.kills = 0; p.hp = MAX_HP; p.dead = false
		respawn(p)
	phase = "play"
	hud.toast("CAPÍTULO 1 — O TEMPLO DAS MARÉS", 3.0)
	queue_lines("intro")
	for p in players:
		send_state(p)
	sync_lobby()

func shoot(p: Player) -> void:
	p.fire_cool = FIRE_COOLDOWN
	p.recoil = 1.0
	sfx_node.play("shot")
	var o := p.cam.global_position
	var d := -p.cam.global_basis.z
	if auto_aim:
		var tgt = aim_target(o, d, AIM_SNAP)
		if tgt != null:
			d = tgt.dir
	var wall_t := world.raycast(o, d, 120.0)
	var h = enemies.ray_hit(o, d, wall_t)
	var flash: MeshInstance3D = p.view.get_meta("flash")
	var muzzle := flash.global_position
	var end: Vector3 = o + d * (h.t if h != null else minf(wall_t, 120.0))
	enemies.tracer(muzzle, end, Color(1, 0.88, 0.63))
	if h != null:
		enemies.hit(h.e, h.head, self)
		if h.e.dead:
			p.kills += 1
			send_state(p)
			hud_dirty = true
		hud.hitmarker(players.find(p), h.head)
		net.send(p.id, { "t": "buzz", "ms": 25 })
	elif wall_t < 120.0:
		spark(end)

func spark(at: Vector3) -> void:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.06; sm.height = 0.12; sm.radial_segments = 6; sm.rings = 3
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(1, 0.82, 0.54)
	mi.mesh = sm; mi.material_override = mat
	mi.position = at
	add_child(mi)
	fx.append({ "n": mi, "mat": mat, "life": 0.2 })

func aim_target(o: Vector3, d: Vector3, max_ang: float):
	var best = null
	var best_score := INF
	for e in enemies.list:
		if e.dead:
			continue
		var v: Vector3 = Vector3(e.pos.x, e.pos.y + 1.15, e.pos.z) - o
		var dist := v.length()
		if dist > 60.0 or dist < 0.5:
			continue
		v /= dist
		var ang := acos(minf(1.0, v.dot(d)))
		var lim := max_ang + atan2(0.6, dist)
		if ang > lim:
			continue
		if world.raycast(o, v, dist) < dist - 0.4:
			continue
		var score := ang / lim + dist / 120.0
		if score < best_score:
			best_score = score
			best = { "e": e, "dir": v, "ang": ang, "dist": dist }
	return best

func aim_assist(p: Player, dt: float) -> void:
	if not auto_aim or phase != "play" or p.climbing or not (p.firing or p.looking):
		return
	var o := p.pos + Vector3(0, EYE, 0)
	var cp := cos(p.pitch)
	var d := Vector3(sin(p.yaw) * cp, sin(p.pitch), cos(p.yaw) * cp)
	var tgt = aim_target(o, d, AIM_ASSIST)
	if tgt == null:
		return
	var want_yaw := atan2(tgt.dir.x, tgt.dir.z)
	var want_pitch := asin(clampf(tgt.dir.y, -1, 1))
	var dy := wrapf(want_yaw - p.yaw, -PI, PI)
	var k := minf(1.0, dt * (7.0 if p.firing else 3.5))
	p.yaw += dy * k
	p.pitch += (want_pitch - p.pitch) * k

func update_player(p: Player, dt: float) -> void:
	if p.dead:
		p.dead_t -= dt
		if p.dead_t <= 0.0:
			respawn(p)
			send_state(p)
			sync_lobby()
		return
	var inp := p.input
	var pressed: int = inp.b & ~p.prev_b
	p.prev_b = inp.b
	if pressed & BTN_JUMP:
		p.jump_buf = 0.15
	p.jump_buf -= dt
	p.hurt = maxf(0.0, p.hurt - dt)
	p.fire_cool -= dt
	p.since_hurt += dt
	if p.since_hurt > REGEN_DELAY and p.hp < MAX_HP:
		var before := int(p.hp / 10.0)
		p.hp = minf(MAX_HP, p.hp + REGEN_RATE * dt)
		if int(p.hp / 10.0) != before:
			hud_dirty = true

	p.yaw -= p.look_dx * LOOK_SENS * p.sens + inp.rx * STICK_LOOK * p.sens * dt
	p.pitch -= p.look_dy * LOOK_SENS * p.sens - inp.ry * STICK_LOOK * 0.7 * p.sens * dt
	p.pitch = clampf(p.pitch, -1.35, 1.35)
	p.looking = p.look_dx != 0.0 or p.look_dy != 0.0 or inp.rx != 0.0 or inp.ry != 0.0
	p.look_dx = 0.0
	p.look_dy = 0.0
	p.firing = (inp.b & BTN_FIRE) != 0
	aim_assist(p, dt)

	var fx_ := sin(p.yaw)
	var fz := cos(p.yaw)
	var rx := -fz
	var rz := fx_
	var mx: float = fx_ * inp.y + rx * inp.x
	var mz: float = fz * inp.y + rz * inp.x
	var mag := Vector2(inp.x, inp.y).length()
	var deadzone := mag < 0.12
	if mag > 1.0:
		mx /= mag; mz /= mag
	var in_climb := level.climb_at(p)
	var sprint: bool = ((inp.b & BTN_SPRINT) != 0 and inp.y > 0.3) or (inp.y > 0.8 and mag > 0.95 and not in_climb)
	var speed := SPRINT if sprint else WALK
	var tx := 0.0 if deadzone else mx * speed
	var tz := 0.0 if deadzone else mz * speed
	var acc := 40.0 if p.on_ground else 14.0
	p.vel.x += clampf(tx - p.vel.x, -acc * dt, acc * dt)
	p.vel.z += clampf(tz - p.vel.z, -acc * dt, acc * dt)

	p.climbing = in_climb and (inp.y > 0.3 or (p.climbing and not p.on_ground))
	if p.climbing:
		p.vel.y = CLIMB_V if inp.y > 0.3 else (-CLIMB_V if inp.y < -0.3 else 0.0)
		if p.jump_buf > 0.0:
			p.climbing = false
			p.vel = Vector3(-fx_ * 3, 6, -fz * 3)
			p.jump_buf = 0.0
	else:
		p.vel.y = maxf(-30.0, p.vel.y - Phys.GRAVITY * dt)

	p.coyote = 0.18 if p.on_ground else p.coyote - dt
	if p.jump_buf > 0.0 and p.coyote > 0.0 and not p.climbing:
		p.vel.y = JUMP_V
		p.coyote = 0.0
		p.jump_buf = 0.0
		p.ground = null
		sfx_node.play("jump")
	world.move_body(p, dt)
	enemies.push_out(p)

	if p.on_ground and phase == "play" and p.pos.z > cp_z:
		var before_cp := level.checkpoint_for(cp_z)
		cp_z = p.pos.z
		if level.checkpoint_for(cp_z) != before_cp:
			sfx_node.play("checkpoint")
			hud.toast("Ponto de controlo", 1.2)

	if p.pos.y < -1.5:
		kill(p, "caiu")
		return
	if level.hazard_at(p):
		damage(p, 34)
		p.vel.y = 6.0

	if (inp.b & BTN_FIRE) and p.fire_cool <= 0.0 and phase != "win":
		shoot(p)

	var chest := p.pos + Vector3(0, 0.9, 0)
	for r in level.relics:
		if not r.taken and r.pos.distance_to(chest) < 1.1:
			r.taken = true
			r.g.visible = false
			p.relics += 1
			relics_found += 1
			sfx_node.play("relic")
			net.send(p.id, { "t": "buzz", "ms": 40 })
			hud.set_relics(relics_found, relics_total)
			send_state(p)
			hud_dirty = true
	if (pressed & BTN_ACTION) and phase == "play" and p.pos.distance_to(level.altar_pos) < 3.2:
		win()

# visual de cada jogador (corre a cada frame desenhado)
func pose_player(p: Player, dt: float) -> void:
	if p.dead:
		return
	var hs := Vector2(p.vel.x, p.vel.z).length()
	p.model.body.rotation.y = p.yaw
	p.model.root.position = p.pos
	p.model.update(dt, hs, p.on_ground, p.climbing, p.vel.y, p.hurt)
	p.bob += dt * hs * 1.9
	var bob_y := sin(p.bob * 2.0) * 0.04 * minf(1.0, hs / 5.0) if p.on_ground else 0.0
	var pos := p.pos + Vector3(0, EYE + bob_y, 0)
	if shake_amt > 0.0:
		pos += Vector3(randf() - 0.5, randf() - 0.5, 0) * shake_amt * 0.3
	p.cam.position = pos
	p.cam.rotation = Vector3(p.pitch, p.yaw + PI, 0)
	p.recoil = maxf(0.0, p.recoil - dt * 8.0)
	var base: Vector3 = p.view.get_meta("base")
	p.view.position = Vector3(base.x + sin(p.bob) * 0.012, base.y + bob_y * 0.4 - (0.3 if p.climbing else 0.0), base.z + p.recoil * 0.06)
	p.view.rotation.x = p.recoil * 0.25
	p.view.get_meta("flash").visible = p.recoil > 0.75

func catch_up() -> void:
	var alive := players.filter(func(p): return not p.dead and p.on_ground)
	if alive.size() < 2:
		return
	var lead: Player = alive[0]
	for p in alive:
		if p.pos.z > lead.pos.z:
			lead = p
	for p in alive:
		if lead.pos.z - p.pos.z > 28 or (lead.pos.z - p.pos.z > 10 and lead.pos.y - p.pos.y > 5):
			p.pos = lead.pos + Vector3(0.8 if p.pos.x > lead.pos.x else -0.8, 0.1, -0.8)
			p.vel = Vector3.ZERO
			p.hurt = 1.0
			hud.toast("%s juntou-se ao grupo" % p.name, 1.2)

func update_overview(dt: float) -> void:
	var alive := players.filter(func(p): return not p.dead)
	var target := Vector3.ZERO
	if alive.size() > 0 and phase != "lobby":
		for p in alive:
			target += p.pos
		target /= alive.size()
	else:
		target = Vector3(sin(_t * 0.1) * 4, 2, 12 + sin(_t * 0.07) * 10)
	over_target = over_target.lerp(target, 1.0 - exp(-dt * 2.0))
	var want := over_target + Vector3(sin(_t * 0.05) * 10, 12, -14)
	over_cam.position = over_cam.position.lerp(want, 1.0 - exp(-dt * 2.0))
	var look := over_target + Vector3(0, 1, 4)
	if over_cam.position.distance_to(look) > 0.1:
		over_cam.transform = over_cam.transform.looking_at(look, Vector3.UP)

# ------------------------------------------------------------------ ciclo
func _physics_process(dt: float) -> void:
	world.begin_frame()
	level.update(dt, self)
	enemies.update(dt, self)
	for p in players:
		update_player(p, dt)

func _process(dt: float) -> void:
	_t += dt
	if phase == "play":
		elapsed += dt
	if kb_on:
		_keyboard()
	catch_up()
	for tr in level.triggers:
		if not tr.done and phase == "play":
			for p in players:
				if p.pos.z > tr.z and not p.dead:
					tr.done = true
					if tr.key != "intro":
						queue_lines(tr.key)
					break
	if dialog_busy:
		dialog_t -= dt
		if dialog_t <= 0.0:
			_next_line()
	for i in range(fx.size() - 1, -1, -1):
		var f: Dictionary = fx[i]
		f.life -= dt
		f.mat.albedo_color.a = f.life / 0.2
		f.n.scale = Vector3.ONE * (1.0 + (0.2 - f.life) * 6.0)
		if f.life <= 0.0:
			f.n.queue_free()
			fx.remove_at(i)
	shake_amt = maxf(0.0, shake_amt - dt * 1.5)
	for p in players:
		pose_player(p, dt)
	update_overview(dt)
	if hud_dirty:
		hud_dirty = false
		sync_lobby()
	hud.frame(players, dt, MAX_HP)

# ------------------------------------------------------------------ comando da TV e teclado (testes)
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		match e.keycode:
			KEY_ENTER, KEY_KP_ENTER:
				if phase == "lobby":
					start_game()
			KEY_K:
				kb_on = true
				if _find("kb") == null:
					add_player("kb", "Teclado", "ana")
	if e is InputEventMouseMotion and kb_on:
		var p := _find("kb")
		if p and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			p.look_dx += e.relative.x * 0.6
			p.look_dy += e.relative.y * 0.6
	if e is InputEventMouseButton and kb_on and e.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _keyboard() -> void:
	var p := _find("kb")
	if p == null:
		return
	p.input.x = float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
	p.input.y = float(Input.is_key_pressed(KEY_W)) - float(Input.is_key_pressed(KEY_S))
	p.input.rx = float(Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_LEFT))
	p.input.ry = float(Input.is_key_pressed(KEY_UP)) - float(Input.is_key_pressed(KEY_DOWN))
	p.input.b = (BTN_JUMP if Input.is_key_pressed(KEY_SPACE) else 0) | (BTN_SPRINT if Input.is_key_pressed(KEY_SHIFT) else 0) \
		| (BTN_ACTION if Input.is_key_pressed(KEY_E) else 0) | (BTN_FIRE if (Input.is_key_pressed(KEY_F) or Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)) else 0)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		get_tree().quit()
