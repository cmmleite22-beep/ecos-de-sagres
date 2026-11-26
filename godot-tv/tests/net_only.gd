extends SceneTree
# Arranca só o servidor embutido (para testar o comando com o Playwright)
func _init():
	var n = load("res://scripts/net.gd").new()
	root.add_child(n)
	n.player_joined.connect(func(id, nm, ch):
		print("JOIN ", id, " ", nm, " ", ch)
		n.send(id, {"t":"welcome","id":id,"char":"ana","color":"#e0a040","name":nm})
		n.send("", {"t":"lobby","players":[{"id":id,"name":nm,"char":"ana"}],"phase":"lobby"}))
	n.message.connect(func(id, m):
		if m.t != "in": print("MSG ", id, " ", JSON.stringify(m))
		if m.t == "in" and int(m.get("b",0)) != 0: print("IN ", id, " b=", m.b)
		if m.t == "ping": n.send(id, {"t":"pong","ts":m.ts}))
	n.player_left.connect(func(id): print("LEAVE ", id))
	print("URL ", n.controller_url())
