run-debug:
	flask --debug run
run-demo:
	gunicorn3 -e SCRIPT_NAME=/hackaday/hell --bind 0.0.0.0:8022 app:app
