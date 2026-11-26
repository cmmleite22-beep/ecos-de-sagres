# Interface da TV: lobby com código QR, barras por vista, mensagens, diálogos e fim do capítulo.
class_name Hud
extends CanvasLayer

const GOLD := Color("e0a040")
const CHARS := {
	"ana": ["Ana Varela", "Arqueóloga", Color("e0a040")],
	"tito": ["Tito Brandão", "Mecânico", Color("3fa7d6")],
	"ines": ["Inês Kwan", "Linguista", Color("d6457a")],
	"rafa": ["Rafa Okoro", "Escalador", Color("59c26b")],
}

var lobby: Control
var qr_rect: TextureRect
var code_lbl: Label
var url_lbl: Label
var slots: Array = []
var start_hint: Label
var ingame: Control
var relics_lbl: Label
var toast_lbl: Label
var dialog_lbl: RichTextLabel
var dialog_panel: PanelContainer
var win_panel: PanelContainer
var win_stats: RichTextLabel
var fps_lbl: Label
var views_box: Control
var views: Array = []
var _toast_t := 0.0
var _fps_acc := 0.0
var _fps_n := 0

func _panel_style(alpha := 0.72, radius := 18) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.06, 0.05, 0.035, alpha)
	s.set_corner_radius_all(radius)
	s.content_margin_left = 28; s.content_margin_right = 28
	s.content_margin_top = 18; s.content_margin_bottom = 18
	s.border_color = Color(0.88, 0.63, 0.25, 0.35)
	s.set_border_width_all(2)
	return s

func _label(text: String, size: int, color := Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 6)
	return l

func _ready() -> void:
	views_box = Control.new()
	views_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	views_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(views_box)

	# ---- lobby
	lobby = CenterContainer.new()
	lobby.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(lobby)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style(0.8, 28))
	lobby.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	panel.add_child(col)
	var title := _label("ECOS DE SAGRES", 72, GOLD)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(title)
	var sub := _label("Capítulo 1 — O Templo das Marés", 30, Color(1, 0.92, 0.75))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(sub)
	var join := HBoxContainer.new()
	join.add_theme_constant_override("separation", 36)
	join.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_child(join)
	qr_rect = TextureRect.new()
	qr_rect.custom_minimum_size = Vector2(300, 300)
	qr_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	qr_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	join.add_child(qr_rect)
	var info := VBoxContainer.new()
	info.alignment = BoxContainer.ALIGNMENT_CENTER
	info.add_theme_constant_override("separation", 8)
	join.add_child(info)
	info.add_child(_label("Lê o código QR com a câmara do telemóvel", 28))
	info.add_child(_label("(o telemóvel tem de estar na mesma rede wifi que a TV)", 22, Color(1, 1, 1, 0.7)))
	info.add_child(_label("ou abre no browser:", 24, Color(1, 1, 1, 0.8)))
	url_lbl = _label("", 30, Color(1, 0.85, 0.55))
	info.add_child(url_lbl)
	info.add_child(_label("Código da sala", 24, Color(1, 1, 1, 0.8)))
	code_lbl = _label("····", 84, GOLD)
	info.add_child(code_lbl)
	var srow := HBoxContainer.new()
	srow.add_theme_constant_override("separation", 14)
	srow.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_child(srow)
	for i in 4:
		var sp := PanelContainer.new()
		var st := _panel_style(0.5, 12)
		st.content_margin_left = 16; st.content_margin_right = 16
		sp.add_theme_stylebox_override("panel", st)
		sp.custom_minimum_size = Vector2(250, 84)
		var v := VBoxContainer.new()
		sp.add_child(v)
		var a := _label("Jogador %d" % (i + 1), 28)
		var b := _label("à espera…", 20, Color(1, 1, 1, 0.6))
		v.add_child(a); v.add_child(b)
		srow.add_child(sp)
		slots.append({ "panel": sp, "style": st, "name": a, "role": b })
	start_hint = _label("Lê o código QR com o telemóvel para entrar", 30, Color(1, 0.92, 0.75))
	start_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(start_hint)

	# ---- em jogo
	ingame = Control.new()
	ingame.set_anchors_preset(Control.PRESET_FULL_RECT)
	ingame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ingame.visible = false
	add_child(ingame)
	relics_lbl = _label("◆ 0 / 0", 40, Color(1, 0.85, 0.4))
	relics_lbl.set_anchors_preset(Control.PRESET_CENTER_TOP)
	relics_lbl.position = Vector2(-80, 14)
	ingame.add_child(relics_lbl)

	toast_lbl = _label("", 46, Color(1, 0.93, 0.75))
	toast_lbl.set_anchors_preset(Control.PRESET_CENTER)
	toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_lbl.size = Vector2(1400, 80)
	toast_lbl.position = Vector2(-700, -260)
	toast_lbl.visible = false
	add_child(toast_lbl)

	dialog_panel = PanelContainer.new()
	dialog_panel.add_theme_stylebox_override("panel", _panel_style(0.75, 14))
	dialog_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	dialog_panel.custom_minimum_size = Vector2(1100, 0)
	dialog_panel.position = Vector2(-550, -170)
	dialog_panel.visible = false
	add_child(dialog_panel)
	dialog_lbl = RichTextLabel.new()
	dialog_lbl.bbcode_enabled = true
	dialog_lbl.fit_content = true
	dialog_lbl.scroll_active = false
	dialog_lbl.add_theme_font_size_override("normal_font_size", 30)
	dialog_lbl.add_theme_font_size_override("bold_font_size", 30)
	dialog_panel.add_child(dialog_lbl)

	win_panel = PanelContainer.new()
	win_panel.add_theme_stylebox_override("panel", _panel_style(0.85, 28))
	var wc := CenterContainer.new()
	wc.set_anchors_preset(Control.PRESET_FULL_RECT)
	wc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(wc)
	wc.add_child(win_panel)
	var wv := VBoxContainer.new()
	win_panel.add_child(wv)
	var wt := _label("O ASTROLÁBIO DE ÂMBAR É VOSSO", 56, GOLD)
	wt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wv.add_child(wt)
	win_stats = RichTextLabel.new()
	win_stats.bbcode_enabled = true
	win_stats.fit_content = true
	win_stats.custom_minimum_size = Vector2(900, 0)
	win_stats.add_theme_font_size_override("normal_font_size", 30)
	wv.add_child(win_stats)
	win_panel.visible = false

	fps_lbl = _label("", 18, Color(1, 1, 1, 0.5))
	fps_lbl.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	fps_lbl.position = Vector2(-110, -32)
	add_child(fps_lbl)

func set_room(code: String, url: String) -> void:
	code_lbl.text = code
	url_lbl.text = url.replace("http://", "").split("?")[0]
	var img := QR.to_image(url, 8, 3)
	if img:
		qr_rect.texture = ImageTexture.create_from_image(img)

func set_players(list: Array) -> void:
	for i in 4:
		var s: Dictionary = slots[i]
		if i < list.size():
			var p: Dictionary = list[i]
			var c: Array = CHARS.get(p.char, ["?", "", Color.WHITE])
			s.name.text = p.name
			s.name.add_theme_color_override("font_color", c[2])
			s.role.text = "%s · %s" % [c[0], c[1]]
			s.style.border_color = c[2]
			s.style.set_border_width_all(3)
		else:
			s.name.text = "Jogador %d" % (i + 1)
			s.name.add_theme_color_override("font_color", Color.WHITE)
			s.role.text = "à espera…"
			s.style.border_color = Color(0.88, 0.63, 0.25, 0.35)
			s.style.set_border_width_all(2)
	start_hint.text = "Carrega em COMEÇAR no telemóvel" if list.size() > 0 else "Lê o código QR com o telemóvel para entrar"

func show_lobby(on: bool) -> void:
	lobby.visible = on
	ingame.visible = not on

func set_relics(n: int, total: int) -> void:
	relics_lbl.text = "◆ %d / %d" % [n, total]

func toast(text: String, secs := 2.0) -> void:
	toast_lbl.text = text
	toast_lbl.visible = true
	_toast_t = secs

func dialog(who: String, text := "", color := Color.WHITE) -> void:
	if who == "":
		dialog_panel.visible = false
		return
	dialog_lbl.text = "[b][color=#%s]%s[/color][/b]  %s" % [color.to_html(false), who, text]
	dialog_panel.visible = true

func show_win(players: Array, found: int, total: int, secs: float) -> void:
	var m := int(secs / 60.0)
	var s := int(fmod(secs, 60.0))
	var t := "[center]Tempo: %dm %02ds · Relíquias: %d/%d\n" % [m, s, found, total]
	for p in players:
		t += "[color=#%s]%s — ◆ %d   ✕ %d[/color]\n" % [p.color.to_html(false), p.name, p.relics, p.kills]
	t += "\n[color=#ffd9a0]Capítulo 2 — \"Areias de Socotra\": em breve.\nCarrega em JOGAR DE NOVO no telemóvel para repetir o capítulo.[/color][/center]"
	win_stats.text = t
	win_panel.visible = true

func hide_win() -> void:
	win_panel.visible = false

# ---- vistas (ecrã dividido): mira, barra de vida, dano, acerto
func layout(rects: Array, players: Array, screen: Vector2) -> void:
	for v in views:
		v.root.queue_free()
	views.clear()
	for i in rects.size():
		var r: Rect2 = rects[i]
		var root := Control.new()
		root.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.position = r.position * screen
		root.size = r.size * screen
		views_box.add_child(root)
		var v := { "root": root }
		if i < players.size():
			var p = players[i]
			var vig := ColorRect.new()
			vig.set_anchors_preset(Control.PRESET_FULL_RECT)
			vig.color = Color(0.8, 0, 0, 0)
			vig.mouse_filter = Control.MOUSE_FILTER_IGNORE
			root.add_child(vig)
			var c0 := root.size * 0.5
			for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
				var tick := ColorRect.new()
				tick.color = Color(1, 1, 1, 0.9)
				tick.size = Vector2(14, 3) if d.y == 0 else Vector2(3, 14)
				tick.position = c0 + d * 12 - tick.size * 0.5 + d * 7
				tick.mouse_filter = Control.MOUSE_FILTER_IGNORE
				root.add_child(tick)
			var hitm := _label("✕", 50, Color(1, 1, 1))
			hitm.modulate.a = 0.0
			hitm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			hitm.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			hitm.set_anchors_preset(Control.PRESET_FULL_RECT)
			root.add_child(hitm)
			var bar := HBoxContainer.new()
			bar.position = Vector2(20, root.size.y - 56)
			bar.add_theme_constant_override("separation", 12)
			root.add_child(bar)
			var nm := _label(p.name, 26, p.color)
			bar.add_child(nm)
			var hp := ProgressBar.new()
			hp.custom_minimum_size = Vector2(220, 22)
			hp.show_percentage = false
			hp.max_value = 100
			var fill := StyleBoxFlat.new(); fill.bg_color = p.color; fill.set_corner_radius_all(6)
			var bg := StyleBoxFlat.new(); bg.bg_color = Color(0, 0, 0, 0.5); bg.set_corner_radius_all(6)
			hp.add_theme_stylebox_override("fill", fill)
			hp.add_theme_stylebox_override("background", bg)
			bar.add_child(hp)
			var vk := _label("", 24, Color(1, 0.9, 0.6))
			bar.add_child(vk)
			var dead := _label("A recuperar…", 44)
			dead.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			dead.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			dead.set_anchors_preset(Control.PRESET_FULL_RECT)
			dead.visible = false
			root.add_child(dead)
			var dmg := _label("▲", 56, Color(1, 0.2, 0.2))
			dmg.modulate.a = 0.0
			dmg.size = Vector2(80, 80)
			dmg.pivot_offset = Vector2(40, 40 + 150)
			dmg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			dmg.position = root.size * 0.5 - Vector2(40, 40 + 150)
			root.add_child(dmg)
			v.merge({ "vig": vig, "hitm": hitm, "hp": hp, "fill": fill, "vk": vk, "dead": dead, "dmg": dmg, "vig_t": 0.0, "hit_t": 0.0, "dmg_t": 0.0, "color": p.color })
		else:
			var ov := _label("Vista geral", 26, Color(1, 1, 1, 0.6))
			ov.position = Vector2(20, 16)
			root.add_child(ov)
		views.append(v)

func hurt(i: int, angle) -> void:
	if i < 0 or i >= views.size() or not views[i].has("vig"):
		return
	views[i].vig_t = 0.4
	if angle != null:
		views[i].dmg.rotation = -angle
		views[i].dmg_t = 1.0

func hitmarker(i: int, head: bool) -> void:
	if i < 0 or i >= views.size() or not views[i].has("hitm"):
		return
	views[i].hit_t = 0.25
	views[i].hitm.add_theme_color_override("font_color", Color(1, 0.3, 0.2) if head else Color(1, 1, 1))

func frame(players: Array, dt: float, max_hp: float) -> void:
	_fps_acc += dt; _fps_n += 1
	if _fps_acc > 1.0:
		fps_lbl.text = "%d fps" % int(round(_fps_n / _fps_acc))
		_fps_acc = 0.0; _fps_n = 0
	if _toast_t > 0.0:
		_toast_t -= dt
		if _toast_t <= 0.0:
			toast_lbl.visible = false
	for i in mini(players.size(), views.size()):
		var v: Dictionary = views[i]
		if not v.has("hp"):
			continue
		var p = players[i]
		v.hp.value = maxf(0.0, p.hp / max_hp * 100.0)
		v.fill.bg_color = Color(0.9, 0.2, 0.15) if p.hp < max_hp * 0.35 else v.color
		v.dead.visible = p.dead
		v.vk.text = "◆ %d   ✕ %d" % [p.relics, p.kills]
		v.vig_t = maxf(0.0, v.vig_t - dt)
		var low := 0.18 if (p.hp < max_hp * 0.35 and not p.dead) else 0.0
		v.vig.color.a = maxf(low, v.vig_t * 0.9)
		v.hit_t = maxf(0.0, v.hit_t - dt)
		v.hitm.modulate.a = minf(1.0, v.hit_t * 4.0)
		v.dmg_t = maxf(0.0, v.dmg_t - dt)
		v.dmg.modulate.a = v.dmg_t
