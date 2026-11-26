# Gerador de códigos QR (modo byte, correção de erros M, versões 1 a 10).
# Baseado no algoritmo de referência de Project Nayuki (qrcodegen, licença MIT).
class_name QR
extends RefCounted

const ECC_PER_BLOCK := [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS := [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const FORMAT_M := 0

var size := 0
var modules := []    # [y][x] -> bool (escuro)
var is_func := []

# Devolve uma matriz de booleanos (linhas) ou [] se o texto for longo demais.
static func encode(text: String) -> Array:
	var q := QR.new()
	return q._encode(text.to_utf8_buffer())

func _encode(data: PackedByteArray) -> Array:
	var ver := 1
	while ver <= 10:
		var cap := _data_codewords(ver) * 8
		var count_bits := 8 if ver < 10 else 16
		if 4 + count_bits + data.size() * 8 <= cap:
			break
		ver += 1
	if ver > 10:
		return []
	# bits do segmento
	var bits: Array[int] = []
	_append(bits, 4, 4)
	_append(bits, data.size(), 8 if ver < 10 else 16)
	for b in data:
		_append(bits, b, 8)
	var cap_bits := _data_codewords(ver) * 8
	_append(bits, 0, mini(4, cap_bits - bits.size()))
	_append(bits, 0, (8 - bits.size() % 8) % 8)
	var pad := 0xEC
	while bits.size() < cap_bits:
		_append(bits, pad, 8)
		pad = 0x11 if pad == 0xEC else 0xEC
	var codewords: Array[int] = []
	codewords.resize(bits.size() / 8)
	codewords.fill(0)
	for i in bits.size():
		codewords[i >> 3] |= bits[i] << (7 - (i & 7))

	size = ver * 4 + 17
	modules = []
	is_func = []
	for y in size:
		var row := []; row.resize(size); row.fill(false)
		var row2 := []; row2.resize(size); row2.fill(false)
		modules.append(row); is_func.append(row2)
	_draw_function_patterns(ver)
	var all := _add_ecc_and_interleave(codewords, ver)
	_draw_codewords(all)
	# escolher a máscara com menor penalização
	var best := 0
	var best_pen := 1 << 30
	for m in 8:
		_apply_mask(m)
		_draw_format_bits(m)
		var pen := _penalty()
		if pen < best_pen:
			best_pen = pen; best = m
		_apply_mask(m) # desfazer (XOR)
	_apply_mask(best)
	_draw_format_bits(best)
	return modules

static func _append(bits: Array[int], val: int, n: int) -> void:
	for i in range(n - 1, -1, -1):
		bits.append((val >> i) & 1)

static func _raw_modules(ver: int) -> int:
	var r := (16 * ver + 128) * ver + 64
	if ver >= 2:
		var na := ver / 7 + 2
		r -= (25 * na - 10) * na - 55
		if ver >= 7:
			r -= 36
	return r

static func _data_codewords(ver: int) -> int:
	return _raw_modules(ver) / 8 - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]

func _set_func(x: int, y: int, dark: bool) -> void:
	modules[y][x] = dark
	is_func[y][x] = true

func _draw_function_patterns(ver: int) -> void:
	for i in size:
		_set_func(6, i, i % 2 == 0)
		_set_func(i, 6, i % 2 == 0)
	for c in [[3, 3], [size - 4, 3], [3, size - 4]]:
		for dy in range(-4, 5):
			for dx in range(-4, 5):
				var xx: int = c[0] + dx
				var yy: int = c[1] + dy
				if xx >= 0 and xx < size and yy >= 0 and yy < size:
					var d := maxi(absi(dx), absi(dy))
					_set_func(xx, yy, d != 2 and d != 4)
	var pos := _align_positions(ver)
	var n := pos.size()
	for i in n:
		for j in n:
			if (i == 0 and j == 0) or (i == 0 and j == n - 1) or (i == n - 1 and j == 0):
				continue
			for dy in range(-2, 3):
				for dx in range(-2, 3):
					_set_func(pos[i] + dx, pos[j] + dy, maxi(absi(dx), absi(dy)) != 1)
	_draw_format_bits(0)
	if ver >= 7:
		var rem := ver
		for i in 12:
			rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
		var bits := (ver << 12) | rem
		for i in 18:
			var bit := ((bits >> i) & 1) != 0
			var a := size - 11 + i % 3
			var b := i / 3
			_set_func(a, b, bit)
			_set_func(b, a, bit)

func _align_positions(ver: int) -> Array:
	if ver == 1:
		return []
	var na := ver / 7 + 2
	var step := int(ceil(float(ver * 4 + 4) / float(na * 2 - 2))) * 2
	var res := [6]
	var p := size - 7
	for i in na - 1:
		res.insert(1, p)
		p -= step
	return res

func _draw_format_bits(mask: int) -> void:
	var data := (FORMAT_M << 3) | mask
	var rem := data
	for i in 10:
		rem = (rem << 1) ^ ((rem >> 9) * 0x537)
	var bits := ((data << 10) | rem) ^ 0x5412
	var g := func(i): return ((bits >> i) & 1) != 0
	for i in range(0, 6):
		_set_func(8, i, g.call(i))
	_set_func(8, 7, g.call(6))
	_set_func(8, 8, g.call(7))
	_set_func(7, 8, g.call(8))
	for i in range(9, 15):
		_set_func(14 - i, 8, g.call(i))
	for i in range(0, 8):
		_set_func(size - 1 - i, 8, g.call(i))
	for i in range(8, 15):
		_set_func(8, size - 15 + i, g.call(i))
	_set_func(8, size - 8, true)

static func _gf_mul(x: int, y: int) -> int:
	var z := 0
	for i in range(7, -1, -1):
		z = (z << 1) ^ ((z >> 7) * 0x11D)
		z ^= ((y >> i) & 1) * x
	return z & 0xFF

static func _rs_divisor(degree: int) -> Array:
	var r := []
	r.resize(degree); r.fill(0)
	r[degree - 1] = 1
	var root := 1
	for i in degree:
		for j in degree:
			r[j] = _gf_mul(r[j], root)
			if j + 1 < degree:
				r[j] ^= r[j + 1]
		root = _gf_mul(root, 0x02)
	return r

static func _rs_remainder(data: Array, div: Array) -> Array:
	var r := []
	r.resize(div.size()); r.fill(0)
	for b in data:
		var f: int = b ^ r.pop_front()
		r.append(0)
		for i in div.size():
			r[i] ^= _gf_mul(div[i], f)
	return r

func _add_ecc_and_interleave(data: Array, ver: int) -> Array:
	var nb: int = NUM_BLOCKS[ver]
	var ecc_len: int = ECC_PER_BLOCK[ver]
	var raw := _raw_modules(ver) / 8
	var n_short := nb - raw % nb
	var short_len := raw / nb
	var div := _rs_divisor(ecc_len)
	var blocks := []
	var k := 0
	for i in nb:
		var l := short_len - ecc_len + (0 if i < n_short else 1)
		var dat := data.slice(k, k + l)
		k += l
		var ecc := _rs_remainder(dat, div)
		if i < n_short:
			dat.append(0)
		blocks.append(dat + ecc)
	var res := []
	for i in blocks[0].size():
		for j in blocks.size():
			if i != short_len - ecc_len or j >= n_short:
				res.append(blocks[j][i])
	return res

func _draw_codewords(data: Array) -> void:
	var i := 0
	var right := size - 1
	while right >= 1:
		if right == 6:
			right = 5
		for vert in size:
			for j in 2:
				var x := right - j
				var upward := ((right + 1) & 2) == 0
				var y := size - 1 - vert if upward else vert
				if not is_func[y][x] and i < data.size() * 8:
					modules[y][x] = ((data[i >> 3] >> (7 - (i & 7))) & 1) != 0
					i += 1
		right -= 2

func _apply_mask(m: int) -> void:
	for y in size:
		for x in size:
			if is_func[y][x]:
				continue
			var inv := false
			match m:
				0: inv = (x + y) % 2 == 0
				1: inv = y % 2 == 0
				2: inv = x % 3 == 0
				3: inv = (x + y) % 3 == 0
				4: inv = (x / 3 + y / 2) % 2 == 0
				5: inv = x * y % 2 + x * y % 3 == 0
				6: inv = (x * y % 2 + x * y % 3) % 2 == 0
				7: inv = ((x + y) % 2 + x * y % 3) % 2 == 0
			if inv:
				modules[y][x] = not modules[y][x]

# penalização simplificada (sequências longas, blocos 2x2 e equilíbrio claro/escuro)
func _penalty() -> int:
	var p := 0
	var dark := 0
	for y in size:
		var run_x := 1
		var run_y := 1
		for x in size:
			if modules[y][x]:
				dark += 1
			if x > 0:
				if modules[y][x] == modules[y][x - 1]:
					run_x += 1
					if run_x == 5: p += 3
					elif run_x > 5: p += 1
				else:
					run_x = 1
				# colunas (usa y como coluna, x como linha)
				if modules[x][y] == modules[x - 1][y]:
					run_y += 1
					if run_y == 5: p += 3
					elif run_y > 5: p += 1
				else:
					run_y = 1
			if x > 0 and y > 0:
				var c: bool = modules[y][x]
				if c == modules[y][x - 1] and c == modules[y - 1][x] and c == modules[y - 1][x - 1]:
					p += 3
	var total := size * size
	var k := int(ceil(absf(dark * 20 - total * 10) / float(total))) - 1
	p += maxi(0, k) * 10
	return p

# Textura (Image) com margem branca, pronta para mostrar na TV
static func to_image(text: String, scale: int = 8, border: int = 3) -> Image:
	var m := encode(text)
	if m.is_empty():
		return null
	var n := m.size()
	var px := (n + border * 2) * scale
	var img := Image.create(px, px, false, Image.FORMAT_RGB8)
	img.fill(Color.WHITE)
	for y in n:
		for x in n:
			if m[y][x]:
				img.fill_rect(Rect2i((x + border) * scale, (y + border) * scale, scale, scale), Color.BLACK)
	return img
