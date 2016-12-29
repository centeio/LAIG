function XMLscene(myInterface) {
    CGFscene.call(this);
	this.interface = myInterface;
}

XMLscene.prototype = Object.create(CGFscene.prototype);
XMLscene.prototype.constructor = XMLscene;

XMLscene.prototype.init = function (application) {
    CGFscene.prototype.init.call(this, application);

	this.camCounter = 0;
	this.currentTime = 0;

    this.initLights();
	this.enableTextures(true);
	
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    this.gl.clearDepth(100.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);    
	this.gl.enable(this.gl.CULL_FACE);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
	this.sceneTagReady = false;
	this.sceneBasicsLoaded = false;

	this.setUpdatePeriod(10);

	this.setPickEnabled(true);

	//Game variables
	this.gameMode = 0; //1- PVP | 2- PVC | 3- PVC Easy
	this.gameModePressed = 0;
	this.play = 0;
	this.computerUnitIndex = 0;
	this.areUnitsFound = 0;
	this.unitsFound = null;
	this.possibleMoves = null;
	this.animationRunning = 0;
	this.computerNodeMoved = 0;
	this.player1Wins = 0;
	this.player2Wins = 0;
	this.rowFrom = -1;
	this.columnFrom = -1;
	this.rowTo = -1;
	this.columnTo = -1;
	this.pieceName = "";
	this.moveValid = -1;
	this.player = 1;
	this.isFinished = 0;
	this.undoComputer = 0;
	this.isEasy = 0;
	this.difficultyPressed = 0;

	//Camera animation variables
	this.activeCameraAnimation = 0;
	this.initalCameraAnimation = 0;
	this.cameraPreviousTime = 0;
	this.cameraVelocityX = 0;
	this.cameraVelocityY = 0;
	this.cameraVelocityZ = 0;
	this.cameraLocked = true;
};

XMLscene.prototype.PlayerVSPlayer = function() {
	this.gameModePressed = 1;
}

XMLscene.prototype.PlayerVSPC = function() {
	this.gameModePressed = 2;
}

XMLscene.prototype.Easy = function() {
	this.difficultyPressed = 1;
}

XMLscene.prototype.Hard = function() {
	this.difficultyPressed = 0;
}

XMLscene.prototype.UnlockCamera = function() {
	this.cameraLocked = false;
	this.interface.gui.remove(this.interface.cameraUnlock);
	this.interface.cameraUnlock = null;
	this.interface.cameraLock = this.interface.gui.add(this, "LockCamera");
	this.camera = new CGFcamera(this.camera.fov, this.camera.near, this.camera.far, this.camera.position, this.camera.target);
	this.interface.setActiveCamera(this.camera);
}

XMLscene.prototype.LockCamera = function() {
	this.cameraLocked = true;
	this.interface.gui.remove(this.interface.cameraLock);
	this.interface.cameraLock = null;
	this.interface.cameraUnlock = this.interface.gui.add(this, "UnlockCamera");
	if(this.player == 1) {
		var graphCamera = this.graph.views.get("player1");
		this.camera = new CGFcamera(graphCamera.fov, graphCamera.near, graphCamera.far, graphCamera.position, graphCamera.target);
	}
	else {
		var graphCamera = this.graph.views.get("player2");
		this.camera = new CGFcamera(graphCamera.fov, graphCamera.near, graphCamera.far, graphCamera.position, graphCamera.target);
	}
}

XMLscene.prototype.Play = function() {
	if(this.play == 0)
		this.play = 1;
	else {
		this.graph.primitives.get("NodesBoard").restartBoard();
		this.play = 1;
		this.player = 1;
		this.animationRunning = 0;
	}
	this.initServer();
	this.isFinished = 0;
	this.isEasy = this.difficultyPressed;
	this.gameMode = this.gameModePressed;
	if(!this.interface.cameraUnlock && !this.interface.cameraLock)
		this.interface.cameraUnlock = this.interface.gui.add(this, 'UnlockCamera');
	document.getElementById("hud").style.display = 'block';
}

XMLscene.prototype.Undo = function() {
	if(this.gameMode == 1) {
		var lastMove = this.graph.primitives.get("NodesBoard").moves.pop();
		if(this.graph.primitives.get("NodesBoard").moves.length > 0)
			var newLastMove = this.graph.primitives.get("NodesBoard").moves[this.graph.primitives.get("NodesBoard").moves.length - 1];
		
		if(this.graph.primitives.get("NodesBoard").moves.length == 0 || 
			(this.player == 1 && (newLastMove[0] == "unit2" || newLastMove[0] == "node2")) ||
			(this.player == 2 && (newLastMove[0] == "unit1" || newLastMove[0] == "node1"))) {
			this.interface.gui.remove(this.interface.undo);
			this.interface.undo = null;
		}

		if(this.player == 1 && (lastMove[0] == "unit1" || lastMove[1] == "node1")) {
			this.rowFrom = lastMove[3];
			this.columnFrom = lastMove[4];
			this.rowTo = lastMove[1];
			this.columnTo = lastMove[2];
			if(lastMove[0] == "node1")
				this.undoMoveNode("node1");
			else
				this.undoMoveUnit("unit1");
			this.graph.primitives.get("NodesBoard").activateAnimation(this.rowFrom, this.columnFrom, this.rowTo, this.columnTo);
		}

		if(this.player == 2 && (lastMove[0] == "unit2" || lastMove[1] == "node2")) {
			this.rowFrom = lastMove[3];
			this.columnFrom = lastMove[4];
			this.rowTo = lastMove[1];
			this.columnTo = lastMove[2];
			if(lastMove[0] == "node2")
				this.undoMoveNode("node2");
			else
				this.undoMoveUnit("unit2");
			this.graph.primitives.get("NodesBoard").activateAnimation(this.rowFrom, this.columnFrom, this.rowTo, this.columnTo);
		}
	} else {
		if(this.undoComputer == 0) {
			if(this.player == 1) {
				var lastMove = this.graph.primitives.get("NodesBoard").moves[this.graph.primitives.get("NodesBoard").moves.length - 1];
				if(lastMove[0] == "unit1" || lastMove[1] == "node1") {
					this.graph.primitives.get("NodesBoard").moves.pop();
					if(this.graph.primitives.get("NodesBoard").moves.length > 0)
						var newLastMove = this.graph.primitives.get("NodesBoard").moves[this.graph.primitives.get("NodesBoard").moves.length - 2];
					
					if(this.graph.primitives.get("NodesBoard").moves.length == 0 || 
						newLastMove[0] == "unit2" || newLastMove[0] == "node2") {
						this.interface.gui.remove(this.interface.undo);
						this.interface.undo = null;
					}

					this.rowFrom = lastMove[3];
					this.columnFrom = lastMove[4];
					this.rowTo = lastMove[1];
					this.columnTo = lastMove[2];
					if(lastMove[0] == "node1")
						this.undoMoveNode("node1");
					else
						this.undoMoveUnit("unit1");
					this.graph.primitives.get("NodesBoard").activateAnimation(this.rowFrom, this.columnFrom, this.rowTo, this.columnTo);
				} else //Continue in update function
					this.undoComputer = 1;
			} else {
				this.interface.gui.remove(this.interface.undo);
				this.interface.undo = null;
			}
		}
	}
}

XMLscene.prototype.initLights = function () {
	this.lights[0].setPosition(2, 3, 3, 1);
    this.lights[0].setDiffuse(1.0,1.0,1.0,1.0);
    this.lights[0].update();
};

XMLscene.prototype.initCameras = function () {
	if(this.play == 0)
		this.camera = new CGFcamera();
	else {
		var graphCamera = this.graph.views.get(this.graph.viewsID[this.camCounter]);
		this.camera = new CGFcamera(graphCamera.fov, graphCamera.near, graphCamera.far, graphCamera.position, graphCamera.target);
	}
};

XMLscene.prototype.changeCamera = function() {
	this.camCounter = (this.camCounter + 1) % this.graph.viewsID.length;
	var graphCamera = this.graph.views.get(this.graph.viewsID[this.camCounter]);
	this.camera = new CGFcamera(graphCamera.fov, graphCamera.near, graphCamera.far, graphCamera.position, graphCamera.target);
}

XMLscene.prototype.changeMaterial = function() {
	for (var component of this.graph.components.values())
		component.changeMaterialCounter();
}

XMLscene.prototype.setDefaultAppearance = function () {
    this.setAmbient(0.2, 0.4, 0.8, 1.0);
    this.setDiffuse(0.2, 0.4, 0.8, 1.0);
    this.setSpecular(0.2, 0.4, 0.8, 1.0);
    this.setShininess(10.0);	
};

// Handler called when the graph is finally loaded. 
// As loading is asynchronous, this may be called already after the application has started the run loop
XMLscene.prototype.onGraphLoaded = function () 
{
	this.gl.clearColor(0,0,0,1);
	this.lights[0].setVisible(true);
};

XMLscene.prototype.getKnotsVector = function(degree) {
	
	var v = new Array();
	for (var i=0; i<=degree; i++) {
		v.push(0);
	}
	for (var i=0; i<=degree; i++) {
		v.push(1);
	}
	return v;
}

XMLscene.prototype.makeSurface = function (degree1, degree2, controlvertexes) {
		
	var knots1 = this.getKnotsVector(degree1); 
	var knots2 = this.getKnotsVector(degree2); 

	console.log(knots1);
	console.log(knots2);
	console.log(degree1);
	console.log(degree2);
	console.log(controlvertexes);
		
	var nurbsSurface = new CGFnurbsSurface(degree1, degree2, knots1, knots2, controlvertexes); 

	return nurbsSurface;	
}

XMLscene.prototype.PlayPVP = function () {
	if (this.pickMode == false) {
		if (this.pickResults != null && this.pickResults.length > 0) {
			for (var i=0; i< this.pickResults.length; i++) {
				var obj = this.pickResults[i][0];
				if (obj) {
					console.log(obj.piece);

					if(obj.piece != null && obj.piece.player == this.player) {
						this.rowFrom = obj.row;
						this.columnFrom = obj.column;
						this.graph.primitives.get("NodesBoard").state = 2;
						//this.pressed = 1;
						//console.log(this.graph.primitives.get("NodesBoard").state);
						console.log(obj.piece);

						this.chosen = obj.piece;
						this.possibleMovesFunction();
						this.possibleMoves = JSON.parse(document.querySelector("#query_result").innerHTML);
						document.querySelector("#query_result").innerHTML = "";
					}

					if(this.graph.primitives.get("NodesBoard").state == 2 && obj.piece == null) {
						this.rowTo = obj.row;
						this.columnTo = obj.column;
						
						if(this.chosen instanceof MyNode)
							this.moveNode(this.chosen.name);
						else
							this.moveUnit(this.chosen.name);
						this.moveValid = document.querySelector("#query_result").innerHTML;
						if(this.moveValid == 1) {
							this.graph.primitives.get("NodesBoard").state = 1;
							this.graph.primitives.get("NodesBoard").moves.push([this.chosen.name, this.rowFrom, this.columnFrom, this.rowTo, this.columnTo]);
							this.graph.primitives.get("NodesBoard").activateAnimation(this.rowFrom, this.columnFrom, this.rowTo, this.columnTo);
							if(this.chosen instanceof MyNode) {
								this.finished();
								this.isFinished = document.querySelector("#query_result").innerHTML;
								if(this.isFinished == 1) {
									if(this.player == 1)
										this.player1Wins++;
									else
										this.player2Wins++;
									document.getElementById("player1Score").innerHTML = this.player1Wins;
									document.getElementById("player2Score").innerHTML = this.player2Wins;
								} else {
									if(this.cameraLocked)
										this.activeCameraAnimation = 1;
									//this.player = this.player == 1 ? 2 : 1;
									//document.getElementById("player").innerHTML = this.player;
								}
							}
							this.possibleMoves = null;
							this.player = this.player == 1 ? 2 : 1;
							document.getElementById("player").innerHTML = this.player;
						}
					}
				}
			}
			this.pickResults.splice(0,this.pickResults.length);
		}	
	}
}

XMLscene.prototype.PlayPVC = function() {
	if (this.pickMode == false) {
		if (this.pickResults != null && this.pickResults.length > 0) {
			for (var i=0; i< this.pickResults.length; i++) {
				var obj = this.pickResults[i][0];
				if(this.player == 1) {
					if (obj) {
						if(obj.piece != null && obj.piece.player == this.player && this.animationRunning == 0) {
							this.rowFrom = obj.row;
							this.columnFrom = obj.column;
							this.graph.primitives.get("NodesBoard").state = 2;
							//this.pressed = 1;
							this.chosen = obj.piece;
						}
						if(this.graph.primitives.get("NodesBoard").state == 2 && obj.piece == null) {
							this.rowTo = obj.row;
							this.columnTo = obj.column;
							
							if(this.chosen instanceof MyNode)
								this.moveNode("node1");
							else
								this.moveUnit("unit1");
							this.moveValid = document.querySelector("#query_result").innerHTML;
							document.querySelector("#query_result").innerHTML = "";
							if(this.moveValid == 1) {
								if(this.cameraLocked)
									this.activeCameraAnimation = 1;
								this.graph.primitives.get("NodesBoard").state = 1;
								this.graph.primitives.get("NodesBoard").moves.push([this.chosen.name, this.rowFrom, this.columnFrom, this.rowTo, this.columnTo]);
								this.graph.primitives.get("NodesBoard").activateAnimation(this.rowFrom, this.columnFrom, this.rowTo, this.columnTo);
								if(this.chosen instanceof MyNode) {
									this.finished();
									this.isFinished = document.querySelector("#query_result").innerHTML;
									if(this.isFinished == 1) {
										this.player1Wins++;
										document.getElementById("player1Score").innerHTML = this.player1Wins;
									} else {
										//this.player = this.player == 1 ? 2 : 1;
										//document.getElementById("player").innerHTML = this.player;
									}
								}
								this.player = this.player == 1 ? 2 : 1;
								document.getElementById("player").innerHTML = this.player;
							}
						}
					}
				}
			}
			this.pickResults.splice(0,this.pickResults.length);
		} else {
			if(this.player == 2) {
				if(this.areUnitsFound == 0) {
					this.findComputerUnits();
					this.unitsFound = JSON.parse(document.querySelector("#query_result").innerHTML);
					document.querySelector("#query_result").innerHTML = "";
					this.areUnitsFound = 1;
				}
				if(this.computerUnitIndex < this.unitsFound.length) {
					if(this.animationRunning == 0) {
						this.moveRandUnit(this.unitsFound[this.computerUnitIndex]);
						var destination = JSON.parse(document.querySelector("#query_result").innerHTML);
						document.querySelector("#query_result").innerHTML = "";
						if(destination[0] != -1) {
							this.graph.primitives.get("NodesBoard").moves.push(["unit2", this.unitsFound[this.computerUnitIndex][0], this.unitsFound[this.computerUnitIndex][1], destination[0], destination[1]]);
							this.graph.primitives.get("NodesBoard").activateAnimation(this.unitsFound[this.computerUnitIndex][0], this.unitsFound[this.computerUnitIndex][1], destination[0], destination[1]);
						}
						this.computerUnitIndex++;
					}
				} else {
					if(this.computerNodeMoved == 0) {
						if(this.animationRunning == 0) {
							this.moveRandNode();
							var nodeDestination = JSON.parse(document.querySelector("#query_result").innerHTML);
							document.querySelector("#query_result").innerHTML = "";
							if(nodeDestination[2] != -1) {
								this.graph.primitives.get("NodesBoard").moves.push(["node2", nodeDestination[0], nodeDestination[1], nodeDestination[2], nodeDestination[3]]);
								this.graph.primitives.get("NodesBoard").activateAnimation(nodeDestination[0], nodeDestination[1], nodeDestination[2], nodeDestination[3]);
							}
							this.computerNodeMoved = 1;
						}
					} else {
						if(this.animationRunning == 0) {
							this.finished();
							this.isFinished = document.querySelector("#query_result").innerHTML;
							if(this.isFinished == 1) {
								this.player2Wins++;
								document.getElementById("player2Score").innerHTML = this.player2Wins;
							} else {
								this.areUnitsFound = 0;
								if(this.cameraLocked)
									this.activeCameraAnimation = 1;
								this.player = this.player == 1 ? 2 : 1;
								document.getElementById("player").innerHTML = this.player;
								this.computerNodeMoved = 0;
								this.computerUnitIndex = 0;
							}
						}
					}
				}
			}
		}
	}
}

XMLscene.prototype.display = function () {
	if(this.play == 1) {
		if(this.gameMode == 1)
			this.PlayPVP();
		else
			this.PlayPVC();
		this.clearPickRegistration();	

		this.pickedId = 1;

		if(this.sceneTagReady && !this.sceneBasicsLoaded) {
			// ---- BEGIN Background, camera and axis setup
			this.axis = new CGFaxis(this, this.graph.axisLength);
			this.initCameras();

			this.sceneBasicsLoaded = true;
			this.interface.addLights();
			// ---- END Background, camera and axis setup

			// it is important that things depending on the proper loading of the graph
			// only get executed after the graph has loaded correctly.
			// This is one possible way to do it
		}

		if(this.sceneBasicsLoaded) {
			this.PlayPVP();
			this.clearPickRegistration();
			
			// Clear image and depth buffer everytime we update the scene
			this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

			// Initialize Model-View matrix as identity (no transformation
			//console.log(this.camera);
			this.updateProjectionMatrix();
			this.loadIdentity();

			// Apply transformations corresponding to the camera position relative to the origin
			this.applyViewMatrix();

			// Draw axis
			this.axis.display();

			this.setDefaultAppearance();

			if (this.graph.loadedOk) {	
				for(var i = 0; i < this.lights.length; i++)
					this.lights[i].update();

				if(this.activeCameraAnimation == 1) {
					if(this.initalCameraAnimation == 0) {
						this.initalCameraAnimation = this.currentTime;
						this.cameraPreviousTime = this.currentTime;
					}
					
					if(((this.currentTime - this.initalCameraAnimation) / 1000) < 1) {
						this.camera.orbit(vec3.fromValues(0,1,0), ((this.currentTime - this.cameraPreviousTime) / 1000) * Math.PI);
						this.cameraPreviousTime = this.currentTime;
					} else {
						var timeExceeded = ((this.currentTime - this.initalCameraAnimation) / 1000) - 1;
						this.camera.orbit(vec3.fromValues(0,1,0), (((this.currentTime - this.cameraPreviousTime) / 1000) - timeExceeded) * Math.PI);
						this.initalCameraAnimation = 0;
						this.activeCameraAnimation = 0;
					}
				}
				
				var matrix = mat4.create();
				mat4.identity(matrix);
			
				this.graph.components.get(this.graph.rootName).display(matrix, "null", "null");
			}
		}
	} else {
		// Clear image and depth buffer everytime we update the scene
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
	}
};

XMLscene.prototype.update = function(currTime) {
	this.currentTime = currTime;

	if(this.graph.loadedOk) {
		if(this.graph.primitives.get("NodesBoard").moves.length > 0 && !this.interface.undo) {
			if(this.gameMode == 1) {
				var lastMove = this.graph.primitives.get("NodesBoard").moves[this.graph.primitives.get("NodesBoard").moves.length - 1];
				
				if(this.player == 1 && (lastMove[0] == "unit1" || lastMove[1] == "node1"))
					this.interface.undo = this.interface.gui.add(this, "Undo");
				
				if(this.player == 2 && (lastMove[0] == "unit2" || lastMove[1] == "node2"))
					this.interface.undo = this.interface.gui.add(this, "Undo");
			} else {
				if(this.graph.primitives.get("NodesBoard").moves.length > 0 && !this.interface.undo && this.player == 1)
					this.interface.undo = this.interface.gui.add(this, "Undo");
			}
		}
	}

	//Undo Computer
	if(this.undoComputer == 1 && this.animationRunning == 0) {
		var lastMove = this.graph.primitives.get("NodesBoard").moves.pop();
		var newLastMove = this.graph.primitives.get("NodesBoard").moves[this.graph.primitives.get("NodesBoard").moves.length - 1];

		if(newLastMove[0] == "unit1" || newLastMove[0] == "node1") {
			this.undoComputer = 0;
			this.player = 2;
			if(this.cameraLocked)
				this.activeCameraAnimation = 1;
			document.getElementById("player").innerHTML = this.player;
		}

		this.rowFrom = lastMove[3];
		this.columnFrom = lastMove[4];
		this.rowTo = lastMove[1];
		this.columnTo = lastMove[2];
		if(lastMove[0] == "node2")
			this.undoMoveNode("node2");
		else
			this.undoMoveUnit("unit2");
		this.graph.primitives.get("NodesBoard").activateAnimation(this.rowFrom, this.columnFrom, this.rowTo, this.columnTo);
	}
};

XMLscene.prototype.getPrologInitRequest = function(requestString, onSuccess, onError, port) {
	var requestPort = port || 8081;
	var request = new XMLHttpRequest();
	request.open('GET', 'http://localhost:'+requestPort+'/'+requestString, true);

	request.onload = onSuccess || function(data){console.log("Request successful. Reply: " + data.target.response);};
	request.onerror = onError || function(){console.log("Error waiting for response");};

	request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
	request.send();
}

XMLscene.prototype.getPrologRequest = function(requestString, onSuccess, onError, port) {
	var requestPort = port || 8081;
	var request = new XMLHttpRequest();
	request.open('GET', 'http://localhost:'+requestPort+'/'+requestString, false);

	request.onload = onSuccess || function(data){console.log("Request successful. Reply: " + data.target.response);};
	request.onerror = onError || function(){console.log("Error waiting for response");};

	request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
	request.send();
}

XMLscene.prototype.initServer = function() {
	this.getPrologInitRequest("init", this.handleReply);
}

XMLscene.prototype.possibleMovesFunction = function() {
	this.getPrologRequest("possibleMoves("+this.rowFrom+","+this.columnFrom+")", this.handleReply);
}

XMLscene.prototype.undoMoveUnit = function(unitName) {
	this.getPrologRequest("undoMoveUnit("+this.rowFrom+","+this.columnFrom+","+this.rowTo+","+this.columnTo+","+unitName+")", this.handleReply);
}

XMLscene.prototype.undoMoveNode = function(nodeName) {
	this.getPrologRequest("undoMoveNode("+this.rowFrom+","+this.columnFrom+","+this.rowTo+","+this.columnTo+","+nodeName+")", this.handleReply);
}

XMLscene.prototype.moveUnit = function(unitName) {
	this.getPrologRequest("moveUnit("+this.rowFrom+","+this.columnFrom+","+this.rowTo+","+this.columnTo+","+unitName+")", this.handleReply);
}

XMLscene.prototype.moveNode = function(nodeName) {
	this.getPrologRequest("moveNode("+this.rowFrom+","+this.columnFrom+","+this.rowTo+","+this.columnTo+","+nodeName+")", this.handleReply);
}

XMLscene.prototype.findComputerUnits = function() {
	this.getPrologRequest("findRandUnits(p2)", this.handleReply);
}

XMLscene.prototype.moveRandUnit = function(Position) {
	this.getPrologRequest("moveRandUnit("+Position+",unit2)", this.handleReply);
}

XMLscene.prototype.moveRandNode = function() {
	this.getPrologRequest("moveRandNode(node2)", this.handleReply);
}

XMLscene.prototype.finished = function() {
	var player = this.player == 1 ? "p1" : "p2";

	this.getPrologRequest("finish("+player+")", this.handleReply);
}

//Handle the Reply
XMLscene.prototype.handleReply = function(data) {
	document.querySelector("#query_result").innerHTML = data.target.response;
}