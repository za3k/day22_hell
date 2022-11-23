#!/bin/python3
import flask, flask_login
from flask import url_for, request, render_template, redirect
from flask_login import current_user
from flask_sock import Sock
import collections, json, queue, random
from datetime import datetime
from base import app,load_info,ajax,DBDict,DBList,random_id,hash_id,full_url_for

# -- Info for every Hack-A-Day project --
load_info({
    "project_name": "Hack-A-Hell",
    "source_url": "https://github.com/za3k/day22_hell",
    "subdir": "/hackaday/hell",
    "description": "Dodge bullets from the music visualizer",
    "instructions": "Fullscreen is recommended. Control with your keyboard or mouse. To make the game harder, reduce your window size. Refresh to try again.",
    "login": False,
    "fullscreen": True,
})

# -- Routes specific to this Hack-A-Day project --

@app.route("/")
def index():
    return render_template('index.html')
