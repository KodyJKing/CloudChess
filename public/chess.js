// Utility --------------------------------------------

function deepClone(obj){return JSON.parse(JSON.stringify(obj));}

function vec(x,y) {return {x : x, y : y};}
function revec(pos) {return {x : parseInt(pos.x), y : parseInt(pos.y)};}
function index(pos){return pos.x + pos.y * 8;}
function loc(i){
	var x = i % 8;
	var y = (i - x) / 8;
	return { x : x, y : y};
}
function add(a, b){ return vec(a.x + b.x, a.y + b.y);}
function sub(a, b){ return vec(a.x - b.x, a.y - b.y);}
function mul(a, b){ return vec(a.x * b, a.y * b);}
function div(a, b){ return vec(a.x / b, a.y / b);}

// Movement -------------------------------------------

var N = vec(0, 1);
var NE = vec(1, 1);
var E = vec(1, 0);
var SE = vec(1, -1);
var S = vec(0, -1);
var SW = vec(-1, -1);
var W = vec(-1, 0);
var NW = vec(-1, 1);

var DIRS = [N, NE, E, SE, S, SW, W, NW];

var Z = vec(0, 0);

function pawnConstraint(board, piece, start, stop){
	var diff = sub(stop, start);
	if(!isForward(diff, piece.color))
		return false;
	var obstruction = getPiece(board, stop);
	if(obstruction)
		return obstruction.color != piece.color && isDiagonal(diff);
	if(Math.abs(diff.y) >= 2)
		return canDoubleMove(board, piece, diff);
	return !isDiagonal(diff) && diff.x == 0;
}

function canDoubleMove(board, piece, diff){
	var dir = div(diff, 2);
	return !piece.hasMoved && isEmpty(board, add(piece.pos, dir));
}

function isDiagonal(diff){
	return Math.abs(diff.x) > 0 && Math.abs(diff.y) > 0;
}

function isForward(diff, color){
	return (diff.y < 0) == (color == 'white');
}

function kingConstraint(board, piece, start, stop){
	var diff = sub(stop, start);
	return !isCastle(diff) || canCastle(board, piece, diff);
}

function isCastle(diff){
	return Math.abs(diff.x) >= 2;
}

function canCastle(board, piece, diff){
	if(piece.hasMoved || isUnderThreat(board, piece))
		return false;
	var dir = deepClone(diff);
	dir.x /= 2;
	var scan = scanLine(board, piece, dir, 7);
	var other = scan.obstruction;
	return other && other.color == piece.color && other.kind == 'rook' && !other.hasMoved;
}

function kingAction(board, piece, start, stop){
	var diff = sub(stop, start);
	if(isCastle(diff)){
		diff.x /= 2;
		var scan = scanLine(board, piece, diff, 7);
		var rookDest = add(start, diff);
		movePiece(board, scan.obstruction, rookDest);
	}
}

function move(repeats, dirs, constraint, action){
	return {repeats : repeats, dirs : dirs, constraint : constraint  || function(){return true}, action : action || function(){}};
}

var moveInfo = {
	rook : move(7, [N,E,S,W]),
	bishop : move(7, [NE, SE, SW, NW]),
	queen : move(7, DIRS.slice()),
	king : move(1, DIRS.concat(mul(E,2), mul(W,2)), kingConstraint, kingAction),
	knight : move(1, [vec(2, 1), vec(-2, 1), vec(-2, -1), vec(2, -1), vec(1, 2), vec(-1, 2), vec(-1, -2), vec(1, -2)]),
	pawn : move(1, DIRS.concat([mul(N,2), mul(S, 2)]), pawnConstraint)
};

var KINDS = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

// Game Objects -----------------------------------

function piece(color, kind){return {color : color, kind : kind, pos : null, hasMoved : false};}

function board(){
	var result = [];
	for(var i = 0; i < 64; i++)
		result.push(null);
	return result;
}

function game(){ return {board : board(), kings : {white : null, black : null}, turn : 'white'}; }

function inBoard(pos){return pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8;}

function getPiece(board, pos){ 
	var ind = index(pos);
	if(ind > board.length)
		return null;
	return board[index(pos)];
}

function setPiece(board, pos, piece){
	if(piece)
	    piece.pos = pos;
	board[index(pos)] = piece;
}
function isEmpty(board, pos){ return getPiece(board, pos) == null;}

function movePiece(board, piece, pos){
	moveInfo[piece.kind].action(board, piece, piece.pos, pos);
	setPiece(board, piece.pos, null);
	setPiece(board, pos, piece);
	piece.hasMoved = true;
}

function playerMovePiece(game, piece, pos){
	movePiece(game.board, piece, pos);
	game.turn = game.turn == 'white' ? 'black' : 'white';
}

var backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
function setup(game){
	var board = game.board;
	for(var x = 0; x < 8; x++){
		setPiece(board, vec(x, 0), piece('black', backRow[x]));
		setPiece(board, vec(x, 7), piece('white', backRow[x]));

		setPiece(board, vec(x, 1), piece('black', 'pawn'));
		setPiece(board, vec(x, 6), piece('white', 'pawn'));
	}
	game.kings['white'] = getPiece(board, vec(4,7));
	game.kings['black'] = getPiece(board, vec(4,0));
}

// Move Gen/Check ---------------------------------

function scanLine(board, piece, dir, repeats){
	var distance = -1;
	var obstruction;
	var covered = [];
	var pos = piece.pos;
	for(var i = 0; i < repeats; i++){
		distance += 1;
		pos = add(pos, dir);
		if(!inBoard(pos))
			break;
		obstruction = getPiece(board, pos);
		if(obstruction !== null){
			break;
		} else {
			covered.push(pos);
		}
	}
	return {end : pos, distance : distance, obstruction : obstruction, covered : covered};
}

function getMoves(game, piece){
	var board = game.board;
	var moveType = moveInfo[piece.kind];
	var result = [];
	for(var dir of moveType.dirs){
		var scan = scanLine(board, piece, dir, moveType.repeats);
		for(var pos of scan.covered){
			if(moveType.constraint(board, piece, piece.pos, pos))
				result.push(pos);
		}
		if(scan.obstruction && scan.obstruction.color != piece.color && moveType.constraint(board, piece, piece.pos, scan.end))
			result.push(scan.end);
	}
	var king = game.kings[piece.color]; //Check king safety.
	if(king){
		return filterByKingSafety(king, result, board, piece);
	}
	return result;
}

function filterByKingSafety(king, moves, board, piece){
	var filtered = [];
	for(var move of moves){
		var copyBoard = deepClone(board);
		var copyPiece = getPiece(copyBoard, piece.pos);
		var copyKing = getPiece(copyBoard, king.pos);
		movePiece(copyBoard, copyPiece, move);
		if(!isUnderThreat(copyBoard, copyKing))
			filtered.push(move);
	}
	return filtered;
}

function isUnderThreat(board, piece){
	for(var kind of KINDS){
		var moveType = moveInfo[kind];
		for(var dir of moveType.dirs){
			var scan = scanLine(board, piece, dir, moveType.repeats);
			var obstruction = scan.obstruction;
			if(obstruction && obstruction.color != piece.color && obstruction.kind == kind && moveType.constraint(board, obstruction, scan.end, piece.pos)){
				return true;
			}
		}
	}
	return false;
}

function checkMove(game, start, stop){
	var piece = getPiece(game.board, start);
	if(piece.color != game.turn)
		return false;
	var moves = getMoves(game, piece);
	for(move of moves){
		if(move.x == stop.x && move.y == stop.y)
			return true;
	}
	return false;
}

if(module) module.exports = {game : game, setup : setup, getMoves : getMoves, getPiece : getPiece, playerMovePiece : playerMovePiece, checkMove : checkMove, revec : revec};