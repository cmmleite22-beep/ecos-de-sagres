# Mercenários do Consórcio Meridiano: patrulham, veem os jogadores e disparam.
class_name Enemies
extends RefCounted

const SIGHT := 26.0
const FIRE_EVERY := 1.5
const DMG := 12.0

var root: Node3D
var world: Phys
var list: Array = []
var tracers: Array = []
var _tracer_mat: StandardMaterial3D

func _init(parent: Node3D, phys: Phys, spots: Array) -> void:
	root = Node3D.new()
	root.name = "Enemies"
	parent.add_child(root)
	world = phys
	for s in spots:
		list.append(_spawn(Vector3(s[0], s[1], s[2]), PI))

func _spawn(p: Vector3, yaw: float) -> Dictionary:
	var m := CharModel.new(Color("2a2a2a"), 1, true)
	m.root.position = p
	root.add_child(m.root)
	return {
		"model": m, "home": p, "pos": p, "yaw": yaw, "hp": 3, "dead": false, "dead_t": 0.0,
		"cool": 1.0 + randf(), "alert": false, "t": randf() * 10.0, "flash": 0.0,
		"see_t": randf() * 0.1, "target": null, "td": SIGHT,
	}

# inimigo atingido pelo raio (origem o, direção d) antes de max_dist
func ray_hit(o: Vector3, d: Vector3, max_dist: float):
	var best = null
	var best_t := max_dist
	for e in list:
		if e.dead:
			continue
		for part in [[1.1, 0.45, false], [1.62, 0.22, true]]:
			var c: Vector3 = Vector3(e.pos.x, e.pos.y + part[0], e.pos.z) - o
			var t := c.dot(d)
			if t < 0.0 or t > best_t:
				continue
			var dist2 := c.length_squared() - t * t
			if dist2 < part[1] * part[1]:
				best_t = t
				best = { "e": e, "t": t, "head": part[2] }
	return best

func hit(e: Dictionary, head: bool, game) -> void:
	e.hp -= 3 if head else 1
	e.alert = true
	e.flash = 0.12
	if e.hp <= 0:
		e.dead = true
		e.dead_t = 0.0
		game.sfx("enemyDown")
		game.hud.toast("Tiro na cabeça!" if head else "Mercenário abatido", 1.0)

func update(dt: float, game) -> void:
	for e in list:
		var m: CharModel = e.model
		if e.dead:
			e.dead_t += dt
			m.body.rotation.x = maxf(-PI / 2, m.body.rotation.x - dt * 4.0)
			m.root.position.y = e.pos.y - minf(0.3, e.dead_t * 0.2)
			if e.dead_t > 6.0:
				m.root.visible = false
			continue
		e.t += dt
		e.flash = maxf(0.0, e.flash - dt)
		# visão: recalculada 10 vezes por segundo (os raios custam)
		e.see_t -= dt
		if e.see_t <= 0.0:
			e.see_t = 0.1
			e.target = null
			e.td = SIGHT
			for p in game.players:
				if p.dead:
					continue
				var d: float = p.pos.distance_to(e.pos)
				if d < e.td and can_see(e, p):
					e.target = p
					e.td = d
		var target = e.target
		if target != null and target.dead:
			target = null
		var speed := 0.0
		if target != null and game.phase == "play":
			e.alert = true
			var want := atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z)
			var dy := wrapf(want - e.yaw, -PI, PI)
			e.yaw += dy * minf(1.0, dt * 5.0)
			var side := sin(e.t * 0.9) * 1.6
			var nx: float = e.home.x + cos(e.yaw) * side
			var nz: float = e.home.z - sin(e.yaw) * side
			speed = Vector2(nx - e.pos.x, nz - e.pos.z).length() / dt
			e.pos = Vector3(nx, e.pos.y, nz)
			e.cool -= dt
			if e.cool <= 0.0 and absf(dy) < 0.3:
				e.cool = FIRE_EVERY * (0.8 + randf() * 0.5)
				fire(e, target, e.td, game)
		else:
			e.yaw += sin(e.t * 0.4) * dt * 0.5
		m.body.rotation.y = e.yaw
		m.root.position = e.pos
		m.update(dt, minf(speed, 3.0), true, false, 0.0, e.flash)
	for i in range(tracers.size() - 1, -1, -1):
		var tr: Dictionary = tracers[i]
		tr.life -= dt
		tr.mat.albedo_color.a = maxf(0.0, tr.life / 0.12)
		if tr.life <= 0.0:
			tr.n.queue_free()
			tracers.remove_at(i)

func can_see(e: Dictionary, p) -> bool:
	var o: Vector3 = e.pos + Vector3(0, 1.6, 0)
	var t: Vector3 = p.pos + Vector3(0, 1.4, 0)
	var d := t - o
	var ln := d.length()
	return world.raycast(o, d / ln, ln) >= ln - 0.3

func fire(e: Dictionary, p, dist: float, game) -> void:
	var o: Vector3 = e.pos + Vector3(0, 1.25, 0)
	var t: Vector3 = p.pos + Vector3(0, 1.3, 0)
	var moving := 0.25 if Vector2(p.vel.x, p.vel.z).length() > 5.0 else 0.0
	var chance := maxf(0.2, 0.85 - dist * 0.025 - moving)
	var did_hit := randf() < chance
	if not did_hit:
		t += Vector3((randf() - 0.5) * 2.0, randf(), (randf() - 0.5) * 2.0)
	tracer(o, t, Color(1.0, 0.31, 0.25))
	game.sfx("enemyShot")
	if did_hit:
		game.damage(p, DMG, e.pos)

func tracer(a: Vector3, b: Vector3, color: Color) -> void:
	var im := ImmediateMesh.new()
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = color
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	# fita fina virada para cima (as linhas de 1 px quase não se veem numa TV)
	var dir := (b - a).normalized()
	var side := dir.cross(Vector3.UP).normalized() * 0.025
	if side.length() < 0.001:
		side = Vector3(0.025, 0, 0)
	var up := dir.cross(side).normalized() * 0.025
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES, mat)
	for s in [side, up]:
		im.surface_add_vertex(a - s); im.surface_add_vertex(a + s); im.surface_add_vertex(b + s)
		im.surface_add_vertex(a - s); im.surface_add_vertex(b + s); im.surface_add_vertex(b - s)
	im.surface_end()
	var mi := MeshInstance3D.new()
	mi.mesh = im
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	tracers.append({ "n": mi, "mat": mat, "life": 0.12 })

func push_out(p) -> void:
	for e in list:
		if e.dead:
			continue
		var dx: float = p.pos.x - e.pos.x
		var dz: float = p.pos.z - e.pos.z
		var d := sqrt(dx * dx + dz * dz)
		if d < 0.75 and d > 0.001 and absf(p.pos.y - e.pos.y) < 1.5:
			p.pos.x = e.pos.x + dx / d * 0.75
			p.pos.z = e.pos.z + dz / d * 0.75

func alive_count() -> int:
	var n := 0
	for e in list:
		if not e.dead:
			n += 1
	return n
