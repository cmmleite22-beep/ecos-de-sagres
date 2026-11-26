# Som sintetizado no arranque (sem ficheiros): os mesmos efeitos da versão web + ambiente de selva.
class_name Sfx
extends Node

const RATE := 22050
var sounds := {}
var pool: Array = []
var _amb_t := 0.0
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	for i in 10:
		var p := AudioStreamPlayer.new()
		add_child(p)
		pool.append(p)
	sounds.jump = _mix([_tone(320, 0.15, "tri", 0.25, 200)])
	sounds.relic = _mix([_tone(880, 0.25, "sin", 0.3), _tone(1175, 0.25, "sin", 0.3, 0, 0.07), _tone(1568, 0.25, "sin", 0.3, 0, 0.14)])
	sounds.hurt = _mix([_tone(180, 0.3, "saw", 0.3, -120)])
	sounds.die = _mix([_tone(260, 0.7, "saw", 0.3, -220)])
	sounds.gate = _mix([_noise(2.2, 0.8, 120), _tone(55, 2.0, "saw", 0.2)])
	sounds.rumble = _mix([_noise(4.0, 1.0, 90)])
	sounds.join = _mix([_tone(660, 0.12, "sin", 0.3), _tone(990, 0.2, "sin", 0.3, 0, 0.1)])
	sounds.checkpoint = _mix([_tone(523, 0.2, "sin", 0.2), _tone(784, 0.3, "sin", 0.2, 0, 0.12)])
	sounds.shot = _mix([_noise(0.12, 0.7, 2200), _tone(140, 0.1, "sq", 0.25, -80)])
	sounds.enemyShot = _mix([_noise(0.1, 0.36, 1400)])
	sounds.enemyDown = _mix([_tone(200, 0.4, "tri", 0.25, -140)])
	var win := []
	var notes := [523, 659, 784, 1046, 784, 1046]
	for i in notes.size():
		win.append(_tone(notes[i], 0.4, "tri", 0.3, 0, i * 0.15))
	sounds.win = _mix(win)
	sounds.wind = _mix([_noise(3.2, 0.08, 700)])
	var chirps := []
	for i in 4:
		chirps.append(_tone(2400, 0.09, "sin", 0.06, 500, 0.13 * i))
	sounds.birds = _mix(chirps)

func play(name: String) -> void:
	if not sounds.has(name):
		return
	for p in pool:
		if not p.playing:
			p.stream = sounds[name]
			p.play()
			return

func _process(delta: float) -> void:
	_amb_t -= delta
	if _amb_t <= 0.0:
		_amb_t = 3.0
		play("wind")
		if rng.randf() < 0.7:
			play("birds")

# --- síntese
func _tone(freq: float, dur: float, kind: String, vol: float, slide := 0.0, delay := 0.0) -> PackedFloat32Array:
	var n := int((dur + delay) * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var ph := 0.0
	var d0 := int(delay * RATE)
	for i in range(d0, n):
		var t := float(i - d0) / RATE
		var f := freq * pow(maxf(30.0, freq + slide) / freq, t / dur) if slide != 0.0 else freq
		ph += f / RATE
		var x := 0.0
		match kind:
			"sin": x = sin(ph * TAU)
			"tri": x = 4.0 * absf(fmod(ph, 1.0) - 0.5) - 1.0
			"saw": x = 2.0 * fmod(ph, 1.0) - 1.0
			"sq": x = 1.0 if fmod(ph, 1.0) < 0.5 else -1.0
		var env := vol * pow(0.001 / vol, t / dur) if vol > 0.001 else 0.0
		out[i] = x * env
	return out

func _noise(dur: float, vol: float, cutoff: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var a := clampf(TAU * cutoff / RATE, 0.0, 1.0)
	var y := 0.0
	for i in n:
		y += a * ((rng.randf() * 2.0 - 1.0) - y)
		var t := float(i) / RATE
		out[i] = y * vol * 2.0 * pow(0.001 / vol, t / dur)
	return out

func _mix(parts: Array) -> AudioStreamWAV:
	var n := 0
	for p in parts:
		n = maxi(n, p.size())
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var s := 0.0
		for p in parts:
			if i < p.size():
				s += p[i]
		data.encode_s16(i * 2, int(clampf(s * 0.6, -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w
