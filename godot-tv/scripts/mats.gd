# Materiais: texturas fotográficas CC0 (Poly Haven) quando existem em res://assets/polyhaven,
# senão texturas procedurais geradas pelo motor (ruído). Pedra com musgo por cima, projeção
# triplanar (sem esticar nas caixas), água com reflexos, folhagem que abana com o vento.
class_name Mats
extends RefCounted

const PH := "res://assets/polyhaven/"

var m := {}          # nome -> Material
var leaf_tex := {}   # nome -> Texture2D

const TRIPLANAR := """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D rough_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform sampler2D moss_noise : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec3 tint : source_color = vec3(1.0);
uniform float tex_scale = 0.35;
uniform float normal_strength = 1.0;
uniform float rough_mul = 1.0;
uniform float moss = 0.0;
uniform vec3 moss_color : source_color = vec3(0.23, 0.31, 0.11);
uniform float wet = 0.0;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec3 bl = pow(abs(wnrm), vec3(4.0));
	bl /= dot(bl, vec3(1.0));
	vec2 ux = wpos.zy * tex_scale, uy = wpos.xz * tex_scale, uz = wpos.xy * tex_scale;
	vec3 a = texture(albedo_tex, ux).rgb * bl.x + texture(albedo_tex, uy).rgb * bl.y + texture(albedo_tex, uz).rgb * bl.z;
	float r = texture(rough_tex, ux).r * bl.x + texture(rough_tex, uy).r * bl.y + texture(rough_tex, uz).r * bl.z;
	vec3 tx = texture(normal_tex, ux).xyz * 2.0 - 1.0;
	vec3 ty = texture(normal_tex, uy).xyz * 2.0 - 1.0;
	vec3 tz = texture(normal_tex, uz).xyz * 2.0 - 1.0;
	tx.xy *= normal_strength; ty.xy *= normal_strength; tz.xy *= normal_strength;
	tx = vec3(tx.xy + wnrm.zy, abs(tx.z) * wnrm.x);
	ty = vec3(ty.xy + wnrm.xz, abs(ty.z) * wnrm.y);
	tz = vec3(tz.xy + wnrm.xy, abs(tz.z) * wnrm.z);
	vec3 wn = normalize(tx.zyx * bl.x + ty.xzy * bl.y + tz.xyz * bl.z);
	float n = texture(moss_noise, wpos.xz * 0.11 + wpos.y * 0.05).r;
	float mo = moss * smoothstep(0.75, 0.98, wn.y * 0.5 + n * 0.6);
	// musgo também nas fendas da base das paredes
	mo = max(mo, moss * 0.8 * smoothstep(0.62, 0.9, n) * (1.0 - smoothstep(0.0, 2.5, fract(wpos.y / 6.0) * 6.0)));
	vec3 col = a * tint;
	col *= mix(1.0, 0.55, wet * smoothstep(1.2, -0.2, wpos.y));
	ALBEDO = mix(col, moss_color * (0.65 + 0.7 * n), clamp(mo, 0.0, 1.0));
	ROUGHNESS = clamp(mix(r * rough_mul, 0.92, mo), 0.05, 1.0);
	NORMAL = normalize((VIEW_MATRIX * vec4(mix(wn, wnrm, mo * 0.6), 0.0)).xyz);
}
"""

const TERRAIN := """
shader_type spatial;
uniform sampler2D grass_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_nrm : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D dirt_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock_nrm : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec3 grass_tint : source_color = vec3(1.0);
varying vec3 wpos;
varying vec3 wnrm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec2 uv = wpos.xz * 0.18;
	float n = texture(noise, wpos.xz * 0.02).r;
	float n2 = texture(noise, wpos.xz * 0.13).r;
	vec3 g = texture(grass_tex, uv).rgb * grass_tint * (0.8 + 0.4 * n);
	vec3 d = texture(dirt_tex, uv * 0.8).rgb;
	float steep = 1.0 - wnrm.y;
	vec3 rk = texture(rock_tex, vec2(wpos.x + wpos.z, wpos.y) * 0.12).rgb;
	float dirt = smoothstep(0.45, 0.75, n + (n2 - 0.5) * 0.5);
	float sand = 1.0 - smoothstep(-0.1, 0.6, wpos.y + (n2 - 0.5) * 0.6);
	vec3 col = mix(g, d, max(dirt * 0.7, sand));
	float rock = smoothstep(0.28, 0.5, steep + (n2 - 0.5) * 0.25);
	col = mix(col, rk, rock);
	col = mix(col, col * 0.6, smoothstep(0.2, -0.3, wpos.y)); // margem molhada
	ALBEDO = col * COLOR.rgb;
	vec3 tn = mix(texture(grass_nrm, uv).xyz, texture(rock_nrm, vec2(wpos.x + wpos.z, wpos.y) * 0.12).xyz, rock);
	NORMAL_MAP = tn;
	NORMAL_MAP_DEPTH = 0.8;
	ROUGHNESS = mix(0.9, 0.75, rock);
}
"""

# versão leve (TVs fracas): uma só projeção (a do eixo dominante) e 3 leituras de textura em vez de 10
const TRIPLANAR_LO := """
shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D rough_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform sampler2D moss_noise : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec3 tint : source_color = vec3(1.0);
uniform float tex_scale = 0.35;
uniform float normal_strength = 1.0;
uniform float rough_mul = 1.0;
uniform float moss = 0.0;
uniform vec3 moss_color : source_color = vec3(0.23, 0.31, 0.11);
uniform float wet = 0.0;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec3 an = abs(wnrm);
	vec2 uv = an.y > max(an.x, an.z) ? wpos.xz : (an.x > an.z ? wpos.zy : wpos.xy);
	uv *= tex_scale;
	vec3 a = texture(albedo_tex, uv).rgb;
	float n = texture(moss_noise, wpos.xz * 0.11 + wpos.y * 0.05).r;
	float mo = moss * smoothstep(0.75, 0.98, wnrm.y * 0.5 + n * 0.6);
	vec3 col = a * tint;
	col *= mix(1.0, 0.55, wet * smoothstep(1.2, -0.2, wpos.y));
	ALBEDO = mix(col, moss_color * (0.65 + 0.7 * n), clamp(mo, 0.0, 1.0));
	ROUGHNESS = mix(0.8 * rough_mul, 0.92, mo);
	NORMAL_MAP = texture(normal_tex, uv).xyz;
	NORMAL_MAP_DEPTH = normal_strength * (1.0 - mo);
}
"""

const TERRAIN_LO := """
shader_type spatial;
uniform sampler2D grass_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D grass_nrm : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D dirt_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D rock_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D rock_nrm : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec3 grass_tint : source_color = vec3(1.0);
varying vec3 wpos;
varying float steep;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	steep = 1.0 - normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz).y;
}
void fragment() {
	vec2 uv = wpos.xz * 0.18;
	float n = texture(noise, wpos.xz * 0.05).r;
	float rock = smoothstep(0.28, 0.5, steep + (n - 0.5) * 0.25);
	vec3 col = rock > 0.5 ? texture(rock_tex, vec2(wpos.x + wpos.z, wpos.y) * 0.12).rgb : texture(grass_tex, uv).rgb * grass_tint * (0.8 + 0.4 * n);
	col = mix(col, col * vec3(1.15, 1.05, 0.85), 1.0 - smoothstep(-0.1, 0.6, wpos.y));
	ALBEDO = col * COLOR.rgb;
	ROUGHNESS = 0.88;
}
"""

const WATER := """
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D n1 : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D n2 : hint_normal, filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.02, 0.12, 0.13);
uniform vec3 shallow : source_color = vec3(0.10, 0.32, 0.30);
varying vec3 wpos;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += sin(wpos.x * 0.35 + TIME * 1.1) * 0.05 + cos(wpos.z * 0.27 + TIME * 0.8) * 0.05;
}
void fragment() {
	vec2 uv = wpos.xz * 0.06;
	vec3 a = texture(n1, uv + vec2(TIME * 0.012, TIME * 0.007)).xyz;
	vec3 b = texture(n2, uv * 2.3 - vec2(TIME * 0.018, -TIME * 0.011)).xyz;
	NORMAL_MAP = normalize(a + b - 1.0) * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.9;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	ALBEDO = mix(shallow, deep, clamp(fres * 1.5 + 0.2, 0.0, 1.0));
	METALLIC = 0.0;
	ROUGHNESS = 0.04;
	SPECULAR = 0.7;
}
"""

const FOLIAGE := """
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_disable;
uniform vec3 tint : source_color = vec3(1.0);
uniform float sway = 0.12;
uniform float cut = 0.45;
void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float h = clamp(VERTEX.y, 0.0, 6.0);
	float t = TIME * 1.3 + w.x * 0.21 + w.z * 0.17;
	VERTEX.x += sin(t) * sway * h * 0.25;
	VERTEX.z += cos(t * 0.8) * sway * h * 0.18;
}
void fragment() {
	vec4 c = texture(tex, UV);
	if (c.a < cut) { discard; }
	ALBEDO = c.rgb * tint * COLOR.rgb;
	ROUGHNESS = 0.75;
	BACKLIGHT = vec3(0.35, 0.45, 0.15);
	if (!FRONT_FACING) { NORMAL = -NORMAL; }
}
"""

var cheap := false

func _init(lightweight := false) -> void:
	cheap = lightweight
	var stone := _texset("stone", ["castle_wall_slates", "medieval_blocks_02", "stone_wall", "rock_wall_08", "castle_brick_07"],
		Color(0.62, 0.58, 0.5), Color(0.38, 0.35, 0.3), 3.0)
	var rock := _texset("rock", ["rock_face", "aerial_rocks_02", "rock_wall_10", "rocks_ground_02", "rock_boulder_dry"],
		Color(0.5, 0.48, 0.44), Color(0.28, 0.27, 0.25), 2.0)
	var sandt := _texset("sand", ["coast_sand_01", "aerial_beach_01", "sand_01", "coast_sand_rocks_02"],
		Color(0.82, 0.74, 0.58), Color(0.66, 0.58, 0.44), 12.0)
	var grass := _texset("grass", ["forrest_ground_01", "forest_leaves_02", "aerial_grass_rock", "leafy_grass"],
		Color(0.34, 0.42, 0.16), Color(0.2, 0.27, 0.09), 8.0)
	var dirt := _texset("dirt", ["brown_mud_leaves_01", "forest_ground_04", "dirt_floor", "brown_mud_02"],
		Color(0.42, 0.33, 0.22), Color(0.26, 0.2, 0.13), 6.0)
	var wood := _texset("wood", ["brown_planks_03", "wood_planks", "old_planks_02", "weathered_planks"],
		Color(0.48, 0.34, 0.2), Color(0.3, 0.2, 0.11), 20.0)
	var bark := _texset("bark", ["bark_brown_02", "bark_willow_02", "pine_bark", "bark_brown_01"],
		Color(0.4, 0.32, 0.24), Color(0.22, 0.17, 0.12), 14.0)
	var carved := _texset("carved", ["carved_stone_wall", "medieval_wall_01", "castle_brick_02_red", "stone_brick_wall_001"],
		Color(0.66, 0.6, 0.5), Color(0.42, 0.38, 0.31), 4.0)
	var mossn := _noise_tex(0.035, 4, false, 256)

	m.stone = _tri(stone, Color(0.86, 0.82, 0.76) if not stone.photo else Color(1, 0.97, 0.92), 0.33, 0.25, mossn)
	m.mossStone = _tri(stone, Color(0.72, 0.74, 0.66) if not stone.photo else Color(0.86, 0.88, 0.8), 0.33, 0.6, mossn)
	m.carved = _tri(carved, Color(1, 0.95, 0.85), 0.45, 0.15, mossn)
	m.rock = _tri(rock, Color(0.8, 0.78, 0.74) if not rock.photo else Color(0.95, 0.93, 0.9), 0.12, 0.4, mossn)
	m.sand = _tri(sandt, Color(0.9, 0.88, 0.84), 0.25, 0.0, mossn)
	m.sand.set_shader_parameter("wet", 1.0)
	m.wood = _tri(wood, Color(1, 1, 1), 0.8, 0.0, mossn)
	m.bark = _tri(bark, Color(1, 1, 1), 0.6, 0.0, mossn)

	var ter := ShaderMaterial.new()
	ter.shader = _shader(TERRAIN_LO if cheap else TERRAIN)
	ter.set_shader_parameter("grass_tex", grass.a); ter.set_shader_parameter("grass_nrm", grass.n)
	ter.set_shader_parameter("dirt_tex", dirt.a)
	ter.set_shader_parameter("rock_tex", rock.a); ter.set_shader_parameter("rock_nrm", rock.n)
	ter.set_shader_parameter("noise", mossn)
	ter.set_shader_parameter("grass_tint", Color(0.95, 1.0, 0.85) if grass.photo else Color(1, 1, 1))
	m.ground = ter

	var water := ShaderMaterial.new()
	water.shader = _shader(WATER)
	water.set_shader_parameter("n1", _noise_tex(0.02, 3, true, 512, 6.0))
	water.set_shader_parameter("n2", _noise_tex(0.05, 2, true, 256, 4.0))
	m.water = water

	m.canvas = _std(Color(0.78, 0.7, 0.52), 0.95)
	m.canvas.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.spike = _std(Color(0.55, 0.55, 0.58), 0.35, 0.9)
	m.bronze = _std(Color(0.72, 0.48, 0.24), 0.35, 1.0)
	m.gold = _std(Color(1.0, 0.78, 0.3), 0.22, 1.0)
	m.gold.emission_enabled = true; m.gold.emission = Color(0.4, 0.25, 0.02); m.gold.emission_energy_multiplier = 0.6
	m.amber = _std(Color(1.0, 0.6, 0.1), 0.1, 0.0)
	m.amber.emission_enabled = true; m.amber.emission = Color(1.0, 0.5, 0.05); m.amber.emission_energy_multiplier = 3.0
	m.plate = _std(Color(0.6, 0.5, 0.35), 0.6, 0.3)
	m.flame = StandardMaterial3D.new()
	m.flame.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.flame.albedo_color = Color(1.0, 0.6, 0.15)
	m.flame.emission_enabled = true
	m.foam = StandardMaterial3D.new()
	m.foam.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.foam.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.foam.albedo_color = Color(1, 1, 1, 0.55)
	m.foam.albedo_texture = _noise_tex(0.08, 3, false, 128)
	m.foam.cull_mode = BaseMaterial3D.CULL_DISABLED

	leaf_tex.frond = _frond_texture()
	leaf_tex.leaves = _leaves_texture()
	leaf_tex.grass = _grass_texture()
	m.frond = _foliage(leaf_tex.frond, Color(0.8, 0.95, 0.6), 0.1)
	m.leaves = _foliage(leaf_tex.leaves, Color(0.75, 0.9, 0.55), 0.06)
	m.grassBlades = _foliage(leaf_tex.grass, Color(0.8, 0.95, 0.55), 0.25)
	m.vine = _foliage(leaf_tex.leaves, Color(0.6, 0.85, 0.45), 0.03)

# ------------------------------------------------------------------ texturas
func _shader(code: String) -> Shader:
	var s := Shader.new()
	s.code = code
	return s

# Conjunto de texturas (cor, normal, rugosidade): foto se existir, senão ruído com rampa de cor
func _texset(slot: String, _candidates: Array, c1: Color, c2: Color, bump: float) -> Dictionary:
	for f in ["jpg", "png"]:
		var a: String = PH + slot + "_diff." + f
		if ResourceLoader.exists(a):
			var n: String = PH + slot + "_nor_gl." + f
			var r: String = PH + slot + "_rough." + f
			return {
				"a": load(a),
				"n": load(n) if ResourceLoader.exists(n) else _noise_tex(0.03, 5, true, 256, bump),
				"r": load(r) if ResourceLoader.exists(r) else null,
				"photo": true,
			}
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_CELLULAR if slot in ["stone", "carved", "rock"] else FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.02 if slot != "wood" else 0.01
	noise.fractal_octaves = 5
	noise.seed = hash(slot) & 0xFFFF
	if slot == "wood" or slot == "bark":
		noise.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	var alb := NoiseTexture2D.new()
	alb.width = 512; alb.height = 512; alb.seamless = true; alb.noise = noise
	var ramp := Gradient.new()
	ramp.set_color(0, c2); ramp.set_color(1, c1)
	ramp.add_point(0.5, c1.lerp(c2, 0.35))
	alb.color_ramp = ramp
	if slot == "wood":
		alb.width = 128; alb.height = 512
	var nrm := NoiseTexture2D.new()
	nrm.width = alb.width; nrm.height = alb.height; nrm.seamless = true; nrm.noise = noise
	nrm.as_normal_map = true; nrm.bump_strength = bump
	return { "a": alb, "n": nrm, "r": null, "photo": false }

func _noise_tex(freq: float, oct: int, normal: bool, size: int, bump := 2.0) -> NoiseTexture2D:
	var noise := FastNoiseLite.new()
	noise.frequency = freq; noise.fractal_octaves = oct
	var t := NoiseTexture2D.new()
	t.width = size; t.height = size; t.seamless = true; t.noise = noise
	if normal:
		t.as_normal_map = true; t.bump_strength = bump
	return t

func _tri(set: Dictionary, tint: Color, scale: float, moss: float, mossn: Texture2D) -> ShaderMaterial:
	var s := ShaderMaterial.new()
	s.shader = _tri_shader()
	s.set_shader_parameter("albedo_tex", set.a)
	s.set_shader_parameter("normal_tex", set.n)
	if set.r:
		s.set_shader_parameter("rough_tex", set.r)
	else:
		s.set_shader_parameter("rough_mul", 0.85)
	s.set_shader_parameter("moss_noise", mossn)
	s.set_shader_parameter("tint", tint)
	s.set_shader_parameter("tex_scale", scale)
	s.set_shader_parameter("moss", moss)
	s.set_shader_parameter("normal_strength", 1.0 if set.photo else 0.7)
	return s

var _tri_s: Shader
func _tri_shader() -> Shader:
	if _tri_s == null:
		_tri_s = _shader(TRIPLANAR_LO if cheap else TRIPLANAR)
	return _tri_s

func _std(c: Color, rough: float, metal := 0.0) -> StandardMaterial3D:
	var s := StandardMaterial3D.new()
	s.albedo_color = c; s.roughness = rough; s.metallic = metal
	return s

var _fol_s: Shader
func _foliage(tex: Texture2D, tint: Color, sway: float) -> ShaderMaterial:
	if _fol_s == null:
		_fol_s = _shader(FOLIAGE)
	var s := ShaderMaterial.new()
	s.shader = _fol_s
	s.set_shader_parameter("tex", tex)
	s.set_shader_parameter("tint", tint)
	s.set_shader_parameter("sway", sway)
	return s

# folha de palmeira: nervura central + folíolos
func _frond_texture() -> ImageTexture:
	var w := 128
	var h := 256
	var img := Image.create(w, h, true, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new(); rng.seed = 7
	for y in h:
		var t := float(y) / h               # 0 = ponta, 1 = base
		var half := sin(t * PI) * 0.48 * w * (0.6 + 0.4 * t)
		for x in w:
			var dx := absf(x - w * 0.5)
			if dx < 1.5:
				img.set_pixel(x, y, Color(0.42, 0.45, 0.2, 1))
				continue
			# folíolos inclinados com pequenos cortes entre eles
			var lean := fmod(y + dx * 0.9, 9.0)
			if dx < half and lean > 1.6:
				var g := 0.32 + 0.25 * (1.0 - dx / maxf(half, 1.0)) + rng.randf() * 0.05
				img.set_pixel(x, y, Color(g * 0.55, g, g * 0.28, 1))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

# cacho de folhas (copas, arbustos, trepadeiras)
func _leaves_texture() -> ImageTexture:
	var s := 256
	var img := Image.create(s, s, true, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new(); rng.seed = 11
	for i in 130:
		var cx := rng.randf_range(30, s - 30)
		var cy := rng.randf_range(30, s - 30)
		var ang := rng.randf() * TAU
		var ln := rng.randf_range(18, 34)
		var wd := ln * 0.42
		var shade := rng.randf_range(0.6, 1.0)
		var ca := cos(ang); var sa := sin(ang)
		for y in range(int(cy - ln), int(cy + ln)):
			for x in range(int(cx - ln), int(cx + ln)):
				if x < 0 or y < 0 or x >= s or y >= s:
					continue
				var u := ((x - cx) * ca + (y - cy) * sa) / ln
				var v := (-(x - cx) * sa + (y - cy) * ca) / wd
				var e := u * u + v * v * (1.0 + u * 0.6)
				if e < 1.0:
					var vein := 0.85 if absf(v) < 0.08 else 1.0
					var g := shade * (0.55 + 0.45 * (1.0 - e)) * vein
					img.set_pixel(x, y, Color(0.2 * g, 0.42 * g, 0.12 * g, 1))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

func _grass_texture() -> ImageTexture:
	var w := 128
	var h := 128
	var img := Image.create(w, h, true, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new(); rng.seed = 5
	for i in 38:
		var x0 := rng.randf_range(6, w - 6)
		var hh := rng.randf_range(0.45, 1.0) * h
		var bend := rng.randf_range(-18, 18)
		var g := rng.randf_range(0.6, 1.0)
		for y in int(hh):
			var t := float(y) / hh
			var x := x0 + bend * t * t
			var wd := 2.4 * (1.0 - t) + 0.4
			for xx in range(int(x - wd), int(x + wd) + 1):
				if xx >= 0 and xx < w:
					var k := 0.55 + 0.45 * t
					img.set_pixel(xx, h - 1 - y, Color(0.28 * g * k, 0.45 * g * k, 0.14 * g * k, 1))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)
