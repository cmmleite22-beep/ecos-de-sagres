# Servidor embutido na TV: HTTP (serve o comando do telemóvel) e WebSocket (/ws) na mesma porta.
# Fala o mesmo protocolo que o servidor Node e o Chromecast, por isso o comando é o mesmo ficheiro.
class_name Net
extends Node

signal player_joined(id: String, pname: String, char: String)
signal player_left(id: String)
signal message(id: String, msg: Dictionary)

const PORTS := [8080, 8081, 8090, 8765]
const MAX_PLAYERS := 4
const WS_GUID := "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
const ALPHA := "ABCDEFGHJKLMNPQRSTUVWXYZ"
const MIME := {
	"html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
	"css": "text/css; charset=utf-8", "json": "application/json",
	"webmanifest": "application/manifest+json", "svg": "image/svg+xml", "png": "image/png",
}

var server := TCPServer.new()
var port := 0
var room := ""
var clients: Array = []   # { tcp, buf, ws, id, last }
var next_id := 1
var _cache := {}
var _ping_t := 0.0

func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	for i in 4:
		room += ALPHA[rng.randi_range(0, ALPHA.length() - 1)]
	for p in PORTS:
		if server.listen(p, "*") == OK:
			port = p
			break
	if port == 0:
		push_error("Não foi possível abrir nenhuma porta para o servidor")
	else:
		print("[net] a ouvir na porta %d, sala %s, ips %s" % [port, room, str(lan_ips())])

static func lan_ips() -> Array:
	var out := []
	for a in IP.get_local_addresses():
		if a.contains(":") or a.begins_with("127.") or a.begins_with("169.254."):
			continue
		out.append(a)
	# preferir redes domésticas típicas
	out.sort_custom(func(a, b): return _rank(a) < _rank(b))
	return out

static func _rank(a: String) -> int:
	if a.begins_with("192.168."): return 0
	if a.begins_with("10."): return 1
	if a.begins_with("172."): return 2
	return 3

func controller_url() -> String:
	var ips := lan_ips()
	var host: String = ips[0] if ips.size() > 0 else "127.0.0.1"
	return "http://%s:%d/controller/?room=%s&native=1" % [host, port, room]

func player_count() -> int:
	var n := 0
	for c in clients:
		if c.id != "":
			n += 1
	return n

# ---------------------------------------------------------------- ciclo
func _process(delta: float) -> void:
	while server.is_connection_available():
		var tcp := server.take_connection()
		tcp.set_no_delay(true)
		clients.append({ "tcp": tcp, "buf": PackedByteArray(), "ws": false, "id": "", "last": Time.get_ticks_msec() })
	_ping_t += delta
	var do_ping := _ping_t > 5.0
	if do_ping:
		_ping_t = 0.0
	var now := Time.get_ticks_msec()
	for c in clients.duplicate():
		var tcp: StreamPeerTCP = c.tcp
		tcp.poll()
		var st := tcp.get_status()
		if st == StreamPeerTCP.STATUS_ERROR or st == StreamPeerTCP.STATUS_NONE:
			_drop(c)
			continue
		if st != StreamPeerTCP.STATUS_CONNECTED:
			continue
		var n := tcp.get_available_bytes()
		if n > 0:
			var r := tcp.get_partial_data(n)
			if r[0] == OK:
				c.buf.append_array(r[1])
				c.last = now
		if c.ws:
			_read_frames(c)
			if do_ping and clients.has(c):
				_send_frame(c, 0x9, PackedByteArray())
			# telemóvel desapareceu (ecrã apagado, wifi perdida)
			if now - c.last > 20000 and clients.has(c):
				_drop(c)
		else:
			_read_http(c)
			if now - c.last > 10000 and clients.has(c):
				_drop(c)

func _drop(c: Dictionary) -> void:
	if not clients.has(c):
		return
	clients.erase(c)
	c.tcp.disconnect_from_host()
	if c.id != "":
		player_left.emit(c.id)

# ---------------------------------------------------------------- HTTP
func _read_http(c: Dictionary) -> void:
	var buf: PackedByteArray = c.buf
	var end := -1
	for i in range(0, buf.size() - 3):
		if buf[i] == 13 and buf[i + 1] == 10 and buf[i + 2] == 13 and buf[i + 3] == 10:
			end = i
			break
	if end < 0:
		if buf.size() > 16384:
			_drop(c)
		return
	var head := buf.slice(0, end).get_string_from_utf8()
	c.buf = buf.slice(end + 4)
	var lines := head.split("\r\n")
	var parts := lines[0].split(" ")
	if parts.size() < 2:
		_drop(c); return
	var headers := {}
	for i in range(1, lines.size()):
		var k := lines[i].find(":")
		if k > 0:
			headers[lines[i].substr(0, k).strip_edges().to_lower()] = lines[i].substr(k + 1).strip_edges()
	var path := parts[1].split("?")[0].uri_decode()
	if path == "/ws" and headers.get("upgrade", "").to_lower() == "websocket":
		var key: String = headers.get("sec-websocket-key", "")
		var hc := HashingContext.new()
		hc.start(HashingContext.HASH_SHA1)
		hc.update((key + WS_GUID).to_utf8_buffer())
		var accept := Marshalls.raw_to_base64(hc.finish())
		var resp := "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n" % accept
		c.tcp.put_data(resp.to_utf8_buffer())
		c.ws = true
		_read_frames(c)
		return
	_serve(c, path)

func _serve(c: Dictionary, path: String) -> void:
	var status := "200 OK"
	var body := PackedByteArray()
	var mime := "text/plain; charset=utf-8"
	if path == "/" or path == "/tv" or path == "/tv/":
		_respond(c, "302 Found", "text/plain", PackedByteArray(), "Location: /controller/?room=%s&native=1\r\n" % room)
		return
	if path == "/health":
		body = "ok".to_utf8_buffer()
	elif path == "/api/info":
		body = JSON.stringify({ "ips": lan_ips(), "port": port, "room": room, "native": true }).to_utf8_buffer()
		mime = MIME.json
	else:
		if path.ends_with("/"):
			path += "index.html"
		if path.contains(".."):
			path = "/404"
		var data = _file(path)
		if data == null and not path.get_file().contains("."):
			data = _file(path + "/index.html")
			if data != null:
				_respond(c, "301 Moved Permanently", "text/plain", PackedByteArray(), "Location: %s/\r\n" % path)
				return
		if data == null:
			status = "404 Not Found"
			body = "404".to_utf8_buffer()
		else:
			body = data
			mime = MIME.get(path.get_extension().to_lower(), "application/octet-stream")
	_respond(c, status, mime, body)

func _respond(c: Dictionary, status: String, mime: String, body: PackedByteArray, extra := "") -> void:
	var head := "HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n%s\r\n" % [status, mime, body.size(), extra]
	var out := head.to_utf8_buffer()
	out.append_array(body)
	c.tcp.put_data(out)
	# fechar depois de enviar (o browser abre uma ligação nova por pedido)
	clients.erase(c)
	c.tcp.disconnect_from_host()

func _file(path: String):
	if _cache.has(path):
		return _cache[path]
	var data = WebAssets.get_file(path)
	if data != null:
		_cache[path] = data
	return data

# ---------------------------------------------------------------- WebSocket
func _read_frames(c: Dictionary) -> void:
	while clients.has(c):
		var b: PackedByteArray = c.buf
		if b.size() < 2:
			return
		var op := b[0] & 0x0F
		var masked := (b[1] & 0x80) != 0
		var ln := b[1] & 0x7F
		var off := 2
		if ln == 126:
			if b.size() < 4: return
			ln = (b[2] << 8) | b[3]
			off = 4
		elif ln == 127:
			if b.size() < 10: return
			ln = 0
			for i in 8:
				ln = (ln << 8) | b[2 + i]
			off = 10
		if ln > 65536:
			_drop(c); return
		var mask := PackedByteArray()
		if masked:
			if b.size() < off + 4: return
			mask = b.slice(off, off + 4)
			off += 4
		if b.size() < off + ln:
			return
		var payload := b.slice(off, off + ln)
		if masked:
			for i in ln:
				payload[i] = payload[i] ^ mask[i % 4]
		c.buf = b.slice(off + ln)
		match op:
			0x1, 0x2:
				_on_text(c, payload.get_string_from_utf8())
			0x8:
				_send_frame(c, 0x8, PackedByteArray())
				_drop(c)
			0x9:
				_send_frame(c, 0xA, payload)
			_:
				pass

func _send_frame(c: Dictionary, op: int, payload: PackedByteArray) -> void:
	var f := PackedByteArray([0x80 | op])
	var n := payload.size()
	if n < 126:
		f.append(n)
	elif n < 65536:
		f.append(126); f.append((n >> 8) & 0xFF); f.append(n & 0xFF)
	else:
		f.append(127)
		for i in range(7, -1, -1):
			f.append((n >> (i * 8)) & 0xFF)
	f.append_array(payload)
	var err: int = c.tcp.put_data(f)
	if err != OK:
		_drop(c)

func _send_json(c: Dictionary, obj: Dictionary) -> void:
	_send_frame(c, 0x1, JSON.stringify(obj).to_utf8_buffer())

func _on_text(c: Dictionary, text: String) -> void:
	var m = JSON.parse_string(text)
	if typeof(m) != TYPE_DICTIONARY:
		return
	var t: String = str(m.get("t", ""))
	if t == "join":
		if c.id != "":
			message.emit(c.id, m)  # já está dentro: a TV reenvia o estado
			return
		var code := str(m.get("code", "")).to_upper().strip_edges()
		if code != room:
			_send_json(c, { "t": "error", "reason": "Sala não encontrada" }); return
		if player_count() >= MAX_PLAYERS:
			_send_json(c, { "t": "error", "reason": "Sala cheia (máx. 4)" }); return
		c.id = "p%d" % next_id
		next_id += 1
		_send_json(c, { "t": "joined", "id": c.id, "code": room })
		player_joined.emit(c.id, str(m.get("name", "Jogador")).substr(0, 14), str(m.get("char", "")))
		return
	if c.id == "":
		return
	m["id"] = c.id
	message.emit(c.id, m)

# TV -> um comando (to = id) ou todos (to = "")
func send(to: String, obj: Dictionary) -> void:
	for c in clients:
		if c.ws and c.id != "" and (to == "" or c.id == to):
			_send_json(c, obj)
