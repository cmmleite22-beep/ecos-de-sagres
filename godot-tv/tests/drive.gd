extends SceneTree
# Arranca o jogo, junta jogadores falsos e tira capturas. Uso:
#   godot --rendering-driver opengl3 -s tests/drive.gd -- <pasta> <n_jogadores>
var main
var out := "/tmp"
var n := 1
var frame := 0
var shots := []

func _init():
	var args = OS.get_cmdline_user_args()
	if args.size() > 0: out = args[0]
	if args.size() > 1: n = int(args[1])
	main = load("res://main.tscn").instantiate()
	root.add_child(main)

func snap(name):
	var img = root.get_texture().get_image()
	img.save_jpg(out + "/" + name + ".jpg", 0.85)
	print("SHOT ", name, " fps=", Engine.get_frames_per_second())

func tp(i, pos, yaw, pitch = -0.05):
	var p = main.players[i]
	p.pos = pos; p.vel = Vector3.ZERO; p.yaw = yaw; p.pitch = pitch

func _process(dt):
	frame += 1
	if frame == 30: snap("lobby")
	if frame == 40:
		for i in n: main.add_player("t%d" % i, ["Ana","Tito","Inês","Rafa"][i], ["ana","tito","ines","rafa"][i])
	if frame == 60: snap("lobby_players")
	if frame == 70: main.start_game()
	if frame == 100: snap("start")
	if frame == 110: for i in n: tp(i, Vector3(i*1.2 - 1, 0, 14), 0.0, 0.08)
	if frame == 150: snap("stairs")
	if frame == 160: for i in n: tp(i, Vector3(i*1.2 - 1, 3, 33), 0.0, -0.1)
	if frame == 200: snap("pillars")
	if frame == 210: for i in n: tp(i, Vector3(i - 1, 3, 47.5), 0.0, 0.0)
	if frame == 250: snap("spikes")
	if frame == 260: for i in n: tp(i, Vector3(i - 1, 9, 100), 0.0, -0.05)
	if frame == 300: snap("corridor")
	if frame == 310: for i in n: tp(i, Vector3(i - 1, 3, 146), 0.0, 0.05)
	if frame == 360: snap("altar")
	if frame == 370: for i in n: tp(i, Vector3(i*1.0 - 1, 3, 30), PI * 0.5, 0.0)
	if frame == 410: snap("side_view")
	if frame == 420: quit()
