extends SceneTree
func _init():
	var texts = ["http://192.168.1.23:8080/controller/?room=ABCD&native=1", "hi", "http://10.0.0.5:8765/controller/?room=WXYZ&native=1&extra=muito-longo-para-forcar-uma-versao-maior-do-codigo-qr-0123456789"]
	for i in texts.size():
		var img = QR.to_image(texts[i], 6, 4)
		img.save_png("/tmp/claude-0/qrt/qr%d.png" % i)
		print("ok ", i, " ", img.get_width())
	quit()
