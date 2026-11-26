# Física simples e determinística (igual à versão web): personagens como caixas contra caixas.
class_name Phys
extends RefCounted

const GRAVITY := 26.0
const STEP_HEIGHT := 0.45

class Box:
	var mn: Vector3
	var mx: Vector3
	var delta := Vector3.ZERO
	var solid := true
	var enabled := true
	func _init(a: Vector3, b: Vector3, is_solid := true) -> void:
		mn = a; mx = b; solid = is_solid
	static func center(c: Vector3, s: Vector3, is_solid := true) -> Box:
		return Box.new(c - s * 0.5, c + s * 0.5, is_solid)
	func move_by(d: Vector3) -> void:
		mn += d; mx += d; delta += d

const CELL := 4.0
var boxes: Array = []
var dynamic: Array = []      # caixas que se movem ao longo de z (sempre testadas)
var grid := {}               # fatia em z -> caixas estáticas que a cruzam
var _grid_ok := false

func add(b: Box, moving_z := false) -> Box:
	boxes.append(b)
	if moving_z:
		dynamic.append(b)
	_grid_ok = false
	return b

func _build_grid() -> void:
	grid.clear()
	for b in boxes:
		if dynamic.has(b):
			continue
		for k in range(int(floor(b.mn.z / CELL)), int(floor(b.mx.z / CELL)) + 1):
			if not grid.has(k):
				grid[k] = []
			grid[k].append(b)
	_grid_ok = true

# caixas sólidas que podem tocar no intervalo [z0, z1]
func near(z0: float, z1: float) -> Array:
	if not _grid_ok:
		_build_grid()
	var out: Array = []
	var k0 := int(floor(minf(z0, z1) / CELL))
	var k1 := int(floor(maxf(z0, z1) / CELL))
	if k1 - k0 > 60:
		return boxes.filter(func(c): return c.solid and c.enabled)
	for k in range(k0, k1 + 1):
		if grid.has(k):
			for c in grid[k]:
				if c.solid and c.enabled and not out.has(c):
					out.append(c)
	for c in dynamic:
		if c.solid and c.enabled:
			out.append(c)
	return out

func begin_frame() -> void:
	for b in boxes:
		b.delta = Vector3.ZERO

# corpo: objeto com pos, vel, radius, height, on_ground, ground, hit_wall
static func _overlap(amin: Vector3, amax: Vector3, c: Box) -> bool:
	return amin.x < c.mx.x and amax.x > c.mn.x and amin.y < c.mx.y and amax.y > c.mn.y and amin.z < c.mx.z and amax.z > c.mn.z

static func _bmin(body) -> Vector3:
	return Vector3(body.pos.x - body.radius, body.pos.y, body.pos.z - body.radius)

static func _bmax(body) -> Vector3:
	return Vector3(body.pos.x + body.radius, body.pos.y + body.height, body.pos.z + body.radius)

func move_body(body, dt: float) -> void:
	if body.ground != null and body.ground.enabled:
		body.pos += body.ground.delta
	var reach: float = body.radius + absf(body.vel.z) * dt + 0.5
	var solids: Array = near(body.pos.z - reach, body.pos.z + reach)
	for axis in [0, 2]:
		var d: float = body.vel[axis] * dt
		if d == 0.0:
			continue
		body.pos[axis] += d
		for c in solids:
			if not _overlap(_bmin(body), _bmax(body), c):
				continue
			var rise: float = c.mx.y - body.pos.y
			if body.on_ground and rise > 0.0 and rise <= STEP_HEIGHT and _free_at(body, solids, rise + 0.01):
				body.pos.y = c.mx.y + 0.001
				continue
			if d > 0.0:
				body.pos[axis] = c.mn[axis] - body.radius - 0.001
			else:
				body.pos[axis] = c.mx[axis] + body.radius + 0.001
			body.vel[axis] = 0.0
			body.hit_wall = true
	body.pos.y += body.vel.y * dt
	var was_ground = body.ground
	body.on_ground = false
	body.ground = null
	for c in solids:
		var bmn := _bmin(body)
		var bmx := _bmax(body)
		if not _overlap(bmn, bmx, c):
			continue
		if body.vel.y <= 0.0 and body.pos.y - body.vel.y * dt >= c.mx.y - 0.25 - absf(c.delta.y):
			body.pos.y = c.mx.y
			body.vel.y = 0.0
			body.on_ground = true
			body.ground = c
		elif body.vel.y > 0.0:
			body.pos.y = c.mn.y - body.height - 0.001
			body.vel.y = 0.0
		else:
			var px := minf(bmx.x - c.mn.x, c.mx.x - bmn.x)
			var pz := minf(bmx.z - c.mn.z, c.mx.z - bmn.z)
			if px < pz:
				body.pos.x += -px if body.pos.x < (c.mn.x + c.mx.x) * 0.5 else px
			else:
				body.pos.z += -pz if body.pos.z < (c.mn.z + c.mx.z) * 0.5 else pz
	if not body.on_ground and was_ground != null and body.vel.y <= 0.0:
		var pmn := _bmin(body) - Vector3(0, STEP_HEIGHT, 0)
		var pmx := Vector3(body.pos.x + body.radius, body.pos.y, body.pos.z + body.radius)
		for c in solids:
			if _overlap(pmn, pmx, c) and c.mx.y <= body.pos.y + 0.01:
				body.pos.y = c.mx.y
				body.vel.y = 0.0
				body.on_ground = true
				body.ground = c
				break

func _free_at(body, solids: Array, dy: float) -> bool:
	var a := _bmin(body) + Vector3(0, dy, 0)
	var b := _bmax(body) + Vector3(0, dy, 0)
	for c in solids:
		if _overlap(a, b, c):
			return false
	return true

func body_in(body, c: Box) -> bool:
	return _overlap(_bmin(body), _bmax(body), c)

# raio contra caixas sólidas (slabs): distância ao primeiro impacto (ou max_dist)
func raycast(o: Vector3, d: Vector3, max_dist := 200.0) -> float:
	var best := max_dist
	for c in near(o.z, o.z + d.z * max_dist):
		var tmin := 0.0
		var tmax := best
		var hit := true
		for a in 3:
			if absf(d[a]) < 1e-8:
				if o[a] < c.mn[a] or o[a] > c.mx[a]:
					hit = false
					break
			else:
				var t1: float = (c.mn[a] - o[a]) / d[a]
				var t2: float = (c.mx[a] - o[a]) / d[a]
				if t1 > t2:
					var tmp := t1; t1 = t2; t2 = tmp
				tmin = maxf(tmin, t1)
				tmax = minf(tmax, t2)
				if tmin > tmax:
					hit = false
					break
		if hit and tmin < best:
			best = tmin
	return best
