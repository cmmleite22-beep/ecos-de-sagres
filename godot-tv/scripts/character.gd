# Personagem procedural com animação de andar, correr, saltar e escalar (igual à versão web).
class_name CharModel
extends RefCounted

const SKIN := [Color("c68e5f"), Color("e2b48a"), Color("d9a77e"), Color("7a4a2e")]
const HAIR := [Color("3a2414"), Color("1a1a1a"), Color("101010"), Color("2a1a10")]

var root := Node3D.new()
var body := Node3D.new()
var arm_l: Node3D
var arm_r: Node3D
var leg_l: Node3D
var leg_r: Node3D
var ring: MeshInstance3D
var tag: Label3D
var phase := 0.0
var _t := 0.0

static func _mat(c: Color, rough := 0.75) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c; m.roughness = rough
	return m

func _cap(r: float, l: float, mat: Material) -> MeshInstance3D:
	var cm := CapsuleMesh.new()
	cm.radius = r; cm.height = l + r * 2; cm.radial_segments = 10; cm.rings = 4
	var mi := MeshInstance3D.new()
	mi.mesh = cm; mi.material_override = mat
	return mi

func _limb(r: float, l: float, mat: Material, x: float, y: float) -> Node3D:
	var pivot := Node3D.new()
	pivot.position = Vector3(x, y, 0)
	var mi := _cap(r, l, mat)
	mi.position.y = -l / 2 - r
	pivot.add_child(mi)
	body.add_child(pivot)
	return pivot

func _init(color: Color, variant: int, enemy := false) -> void:
	root.add_child(body)
	var skin := _mat(SKIN[variant % 4], 0.6)
	var shirt := _mat(color, 0.8)
	var pants := _mat(Color("4b4a3c") if not enemy else Color("262626"), 0.9)
	var boots := _mat(Color("2b1d12"), 0.7)
	var hair := _mat(HAIR[variant % 4], 0.8)
	var gear := _mat(Color("5a4630") if not enemy else Color("1d1d1d"), 0.8)

	var torso := _cap(0.24, 0.42, shirt)
	torso.position.y = 1.12; torso.scale = Vector3(1, 1, 0.75)
	body.add_child(torso)
	var belt := MeshInstance3D.new()
	var bc := CylinderMesh.new(); bc.top_radius = 0.235; bc.bottom_radius = 0.235; bc.height = 0.08
	belt.mesh = bc; belt.material_override = gear; belt.position.y = 0.88; belt.scale = Vector3(1, 1, 0.78)
	body.add_child(belt)
	var head := Node3D.new()
	head.position.y = 1.62
	body.add_child(head)
	var skull := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.17; sm.height = 0.34; sm.radial_segments = 16; sm.rings = 10
	skull.mesh = sm; skull.material_override = skin
	head.add_child(skull)
	var hm := MeshInstance3D.new()
	var hs := SphereMesh.new(); hs.radius = 0.18; hs.height = 0.36; hs.is_hemisphere = true
	hm.mesh = hs; hm.material_override = hair; hm.position = Vector3(0, 0.0, -0.01)
	head.add_child(hm)
	if enemy:
		var helmet := MeshInstance3D.new()
		var hh := SphereMesh.new(); hh.radius = 0.2; hh.height = 0.4; hh.is_hemisphere = true
		helmet.mesh = hh; helmet.material_override = _mat(Color("2f3326"), 0.6); helmet.position.y = 0.02
		head.add_child(helmet)
		var visor := MeshInstance3D.new()
		var vb := BoxMesh.new(); vb.size = Vector3(0.26, 0.06, 0.05)
		var vm := StandardMaterial3D.new()
		vm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; vm.albedo_color = Color(1, 0.16, 0.16)
		visor.mesh = vb; visor.material_override = vm; visor.position = Vector3(0, 0.02, 0.16)
		head.add_child(visor)
	else:
		if variant == 0 or variant == 2:
			var tail := _cap(0.05, 0.22, hair)
			tail.position = Vector3(0, -0.05, -0.2); tail.rotation.x = 0.5
			head.add_child(tail)
		if variant == 1:
			var brim := MeshInstance3D.new()
			var b := CylinderMesh.new(); b.top_radius = 0.3; b.bottom_radius = 0.3; b.height = 0.02
			brim.mesh = b; brim.material_override = gear; brim.position.y = 0.1
			head.add_child(brim)
			var top := MeshInstance3D.new()
			var tc := CylinderMesh.new(); tc.top_radius = 0.16; tc.bottom_radius = 0.18; tc.height = 0.14
			top.mesh = tc; top.material_override = gear; top.position.y = 0.17
			head.add_child(top)
		for s in [-1.0, 1.0]:
			var eye := MeshInstance3D.new()
			var es := SphereMesh.new(); es.radius = 0.022; es.height = 0.044; es.radial_segments = 6; es.rings = 4
			eye.mesh = es; eye.material_override = _mat(Color(0.07, 0.07, 0.07), 0.3)
			eye.position = Vector3(0.06 * s, 0.02, 0.155)
			head.add_child(eye)
	var pack := MeshInstance3D.new()
	var pb := BoxMesh.new(); pb.size = Vector3(0.34, 0.42, 0.18)
	pack.mesh = pb; pack.material_override = gear; pack.position = Vector3(0, 1.15, -0.24)
	body.add_child(pack)
	arm_l = _limb(0.07, 0.42, shirt, -0.32, 1.38)
	arm_r = _limb(0.07, 0.42, shirt, 0.32, 1.38)
	for a in [arm_l, arm_r]:
		var hand := MeshInstance3D.new()
		var hsm := SphereMesh.new(); hsm.radius = 0.075; hsm.height = 0.15; hsm.radial_segments = 8; hsm.rings = 5
		hand.mesh = hsm; hand.material_override = skin; hand.position.y = -0.62
		a.add_child(hand)
	leg_l = _limb(0.095, 0.48, pants, -0.12, 0.88)
	leg_r = _limb(0.095, 0.48, pants, 0.12, 0.88)
	for l in [leg_l, leg_r]:
		var boot := MeshInstance3D.new()
		var bb := BoxMesh.new(); bb.size = Vector3(0.16, 0.12, 0.26)
		boot.mesh = bb; boot.material_override = boots; boot.position = Vector3(0, -0.76, 0.04)
		l.add_child(boot)
	if enemy:
		var gun := MeshInstance3D.new()
		var gb := BoxMesh.new(); gb.size = Vector3(0.08, 0.1, 0.55)
		gun.mesh = gb; gun.material_override = _mat(Color(0.07, 0.07, 0.07), 0.4)
		gun.position = Vector3(0.22, 1.2, 0.35)
		body.add_child(gun)
	ring = MeshInstance3D.new()
	var tm := TorusMesh.new(); tm.inner_radius = 0.42; tm.outer_radius = 0.52; tm.rings = 32; tm.ring_segments = 3
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.albedo_color = Color(1, 0.16, 0.16, 0.8) if enemy else Color(color, 0.8)
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.mesh = tm; ring.material_override = rm
	ring.position.y = 0.03; ring.scale = Vector3(1, 0.05, 1)
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(ring)

func add_tag(text: String, color: Color) -> void:
	tag = Label3D.new()
	tag.text = text
	tag.modulate = color
	tag.outline_modulate = Color(0, 0, 0, 0.7)
	tag.outline_size = 10
	tag.font_size = 48
	tag.pixel_size = 0.006
	tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	tag.no_depth_test = true
	tag.position.y = 2.2
	root.add_child(tag)

func set_layer(mask: int) -> void:
	_set_layer(root, mask)

func _set_layer(n: Node, mask: int) -> void:
	if n is VisualInstance3D:
		n.layers = mask
	for c in n.get_children():
		_set_layer(c, mask)

# st: speed, on_ground, climbing, vy, hurt
func update(dt: float, speed: float, on_ground: bool, climbing: bool, vy: float, hurt: float) -> void:
	_t += dt
	var k := minf(1.0, speed / 7.5)
	phase += dt * (4.0 + speed * 1.6)
	var sw := sin(phase)
	var al := 0.0
	var ar := 0.0
	var ll := 0.0
	var lr := 0.0
	var lean := 0.0
	var bob := 0.0
	if climbing:
		var c := sin(phase * 0.8) * (1.0 if speed > 0.1 else 0.2)
		al = -2.6 + c * 0.4; ar = -2.6 - c * 0.4; ll = -0.4 - c * 0.4; lr = -0.4 + c * 0.4
	elif not on_ground:
		al = -2.2 + clampf(vy * 0.06, -0.6, 0.6); ar = al
		ll = -0.6; lr = 0.3
	else:
		al = sw * 0.9 * k; ar = -sw * 0.9 * k
		ll = -sw * 0.8 * k; lr = sw * 0.8 * k
		lean = 0.18 * k
		bob = absf(cos(phase)) * 0.06 * k
		if k < 0.05:
			var br := sin(_t * 1.6) * 0.02
			al = br; ar = -br
	var lerp := 1.0 - exp(-dt * 18.0)
	arm_l.rotation.x += (al - arm_l.rotation.x) * lerp
	arm_r.rotation.x += (ar - arm_r.rotation.x) * lerp
	leg_l.rotation.x += (ll - leg_l.rotation.x) * lerp
	leg_r.rotation.x += (lr - leg_r.rotation.x) * lerp
	body.rotation.x += (lean - body.rotation.x) * lerp
	body.position.y = bob
	body.visible = not (hurt > 0.0 and int(hurt * 12.0) % 2 == 0)
