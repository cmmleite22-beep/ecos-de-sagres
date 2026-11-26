extends SceneTree
# Teste de lógica (sem gráficos): um jogador anda, sobe a escadaria, salta os pilares,
# dispara contra um mercenário, apanha relíquias e termina no altar.
var main
var t := 0.0
var step := 0
var fails := []
var maxz := 0.0
var on_p2 := false

func _init():
	main = load("res://main.tscn").instantiate()
	root.add_child(main)

func check(cond, msg):
	print(("OK   " if cond else "FAIL ") + msg)
	if not cond: fails.append(msg)

func p(): return main.players[0]

func _physics_process(dt):
	t += dt
	match step:
		0:
			if t > 0.5:
				main.add_player("b1", "Bot", "rafa")
				main.start_game()
				main.players[0].pos.x = 0.0
				check(main.phase == "play", "jogo começou")
				step = 1; t = 0
		1: # andar para a frente 4 s (acampamento até à escadaria)
			p().input.y = 1.0
			if t > 4.0:
				check(p().pos.z > 18.0, "andou para a frente (z=%.1f)" % p().pos.z)
				check(p().pos.y > 2.9, "subiu a escadaria (y=%.2f)" % p().pos.y)
				p().input.y = 0; step = 3; t = 0
		2: # subir a escadaria
			if t > 2.5:
				check(p().pos.y > 2.9, "subiu a escadaria (y=%.2f, z=%.1f)" % [p().pos.y, p().pos.z])
				p().input.y = 0; step = 3; t = 0
		3: # pilares: posicionar na borda e saltar a correr
			tp(Vector3(0, 3, 33.6)); p().vel = Vector3.ZERO; p().yaw = 0
			p().input.y = 1.0; step = 4; t = 0
		4:
			if p().pos.z > 34.4 and p().input.b == 0 and t < 0.6: p().input.b = 1
			elif t > 0.3: p().input.b = 0
			if not p().dead: maxz = max(maxz, p().pos.z)
			if p().on_ground and p().pos.z > 37.5 and p().pos.z < 41.3: on_p2 = true
			if t > 1.6:
				check(on_p2, "aterrou no 2.º pilar (z máx=%.1f)" % maxz)
				p().input.y = 0; step = 5; t = 0
			if false:
				check(not p().dead and p().pos.z > 38.0, "saltou para os pilares (z=%.1f y=%.1f morto=%s)" % [p().pos.z, p().pos.y, p().dead])
				p().input.y = 0; step = 5; t = 0
		5: # disparar contra o mercenário em (5,3,62.5) a partir de perto
			tp(Vector3(4.5, 3, 59.5)); p().vel = Vector3.ZERO
			var e = main.enemies.list[1]
			p().yaw = atan2(e.pos.x - p().pos.x, e.pos.z - p().pos.z); p().pitch = 0.0
			p().input.b = 8; step = 6; t = 0
		6:
			if t > 2.0:
				p().input.b = 0
				check(p().kills >= 1, "abateu um mercenário (kills=%d)" % p().kills)
				step = 7; t = 0
		7: # relíquia em (6,3,61)
			tp(Vector3(6, 3, 60.4)); p().vel = Vector3.ZERO
			step = 8; t = 0
		8:
			if t > 0.5:
				check(main.relics_found >= 1, "apanhou relíquia (%d)" % main.relics_found)
				tp(Vector3(4.5, 3.1, 64.5)); p().vel = Vector3.ZERO
				step = 9; t = 0
		9:
			if t > 4.0:
				check(main.level.gate_latched, "placa abriu o portão (1 jogador)")
				tp(Vector3(0, 3.85, 158.7)); p().vel = Vector3.ZERO; p().yaw = 0
				for e in main.enemies.list: e.dead = true
				step = 10; t = 0
		10:
			if t > 0.5: p().input.b = 4
			if t > 0.7:
				p().input.b = 0
				check(main.phase == "win", "terminou no altar (fase=%s)" % main.phase)
				step = 11; t = 0
		11:
			if t > 3.0:
				main._on_msg("b1", {"t": "start"})
				step = 12; t = 0
		12:
			if t > 0.5:
				check(main.phase == "play" and main.relics_found == 0, "JOGAR DE NOVO recomeçou")
				print("RESULTADO: %d falhas" % fails.size())
				quit(1 if fails.size() else 0)

func tp(v):
	if p().dead: main.respawn(p())
	p().pos = v; p().vel = Vector3.ZERO; p().ground = null
