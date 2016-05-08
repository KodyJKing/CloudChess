var fs = require('fs');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended : true
}));

var chess = require('./public/chess.js');
//var db = require('./db.js');

//var instance;
var game = chess.game();
chess.setup(game);
// db.getInstance(function(ins){
// 	instance = ins;
// 	game = ins.game;
// });

app.use(express.static('public'));

app.get('/game', function (req, res) {
  res.send(game);
  //console.log('Served game!');
});

app.post('/submit', function(req, res){
	var move = req.body;
	move.start = chess.revec(move.start);
	move.stop = chess.revec(move.stop);
	if(chess.checkMove(game, move.start, move.stop)){
		chess.performMove(game, move);
		//if(chess.gameState(game) == 'playing') chess.performMove(game, chess.nDeepMove(game, 3, false));
		//db.saveInstance(instance);
		res.send(true);
	}
	else {
		res.send(false);
	}
});

app.get('/reset', function(req, res){
	//instance.game = chess.game();
	//game = instance.game;
	game = chess.game();
	chess.setup(game);
	res.send(true);
	//db.saveInstance(instance);
	console.log('Reset game!');
});

app.listen(3000, function () {
  console.log('Chess app listening on port 3000!');
});

delay = 5;
function aiLoop(){
	var move = chess.nDeepMove(game, 1, false);
	if(move && chess.checkMove(game, move.start, move.stop))
		chess.performMove(game, move);
	else
		console.log('Attempted illegal move!');
	if(chess.gameState(game) == 'playing') setTimeout(aiLoop, delay);
}
setTimeout(aiLoop, 1000);