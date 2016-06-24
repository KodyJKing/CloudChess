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
function veq(a, b){ return a.x == b.x && a.y == b.y;}

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
	return diff.y != 0 && ((diff.y < 0) == (color == 'white'));
}

function kingConstraint(board, piece, start, stop){
	var diff = sub(stop, start);
	return !isCastle(diff) || canCastle(board, piece, diff);
}

function isCastle(diff){
	return Math.abs(diff.x) >= 2;
}

function canCastle(board, piece, diff){
	return false;
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

function moveType(repeats, dirs, constraint, action){
	return {repeats : repeats, dirs : dirs, constraint : constraint  || function(){return true}, action : action || function(){}};
}

var moveInfo = {
	rook : moveType(7, [N,E,S,W]),
	bishop : moveType(7, [NE, SE, SW, NW]),
	queen : moveType(7, DIRS),
	king : moveType(1, DIRS.concat(mul(E,2), mul(W,2)), kingConstraint, kingAction),
	knight : moveType(1, [vec(2, 1), vec(-2, 1), vec(-2, -1), vec(2, -1), vec(1, 2), vec(-1, 2), vec(-1, -2), vec(1, -2)]),
	pawn : moveType(1, DIRS.concat([mul(N,2), mul(S, 2)]), pawnConstraint)
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

function game(){return {board : board(), kings : {white : null, black : null}, turn : 'white'}; }
function cloneGame(game){
	var clone = deepClone(game);
	clone.kings.white = getPiece(clone.board, clone.kings.white.pos);
	clone.kings.black = getPiece(clone.board, clone.kings.black.pos);
	return clone;
}

function move(start, stop){return {start : start, stop : stop}};

function opposite(color){return color == 'white' ? 'black' : 'white'}

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
	game.turn = opposite(game.turn);
}

function performMove(game, move){
	var piece = getPiece(game.board, move.start);
	playerMovePiece(game, piece, move.stop);
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

function scanLine(board, pos, dir, repeats){
	var distance = -1;
	var obstruction;
	var covered = [];
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

function getMoves(game, piece, ignoreKingSafety, onlyCaptures){
	var board = game.board;
	var moveType = moveInfo[piece.kind];
	var result = [];
 	for(var dir of moveType.dirs){
		var scan = scanLine(board, piece.pos, dir, moveType.repeats);
		if(scan.obstruction && scan.obstruction.color != piece.color && moveType.constraint(board, piece, piece.pos, scan.end))
			result.push(move(piece.pos, scan.end));
		if(onlyCaptures)
			continue;
		for(var pos of scan.covered){
			if(moveType.constraint(board, piece, piece.pos, pos)){
				result.push(move(piece.pos, pos));
			}
		}
	}
	var king = game.kings[piece.color];
	if(king && !ignoreKingSafety){
		return filterByKingSafety(king, result, board, piece);
	}
	return result;
}

function allMoves(game, ignoreKingSafety){
	result = [];
	for(var x = 0; x < 8; x++){
		for(var y = 0; y < 8; y++){
			var pos = vec(x,y);
			var piece = getPiece(game.board, pos);
			if(!piece || piece.color != game.turn)
				continue;

			var moves = getMoves(game, piece, ignoreKingSafety);
			for(var move of moves)
				result.push(move);
		}
	}
	return result
}

function filterByKingSafety(king, moves, board, piece){
	var filtered = [];
	for(var move of moves){
		var copyBoard = deepClone(board);
		var copyPiece = getPiece(copyBoard, piece.pos);
		var copyKing = getPiece(copyBoard, king.pos);
		movePiece(copyBoard, copyPiece, move.stop);
		if(!isUnderThreat(copyBoard, copyKing))
			filtered.push(move);
	}
	return filtered;
}

function isUnderThreat(board, piece){
	if(!piece)
		return false;
	for(var kind of KINDS){
		var moveType = moveInfo[kind];
		for(var dir of moveType.dirs){
			var scan = scanLine(board, piece.pos, dir, moveType.repeats);
			var obstruction = scan.obstruction;
			if(obstruction && obstruction.color != piece.color && obstruction.kind == kind && moveType.constraint(board, obstruction, scan.end, piece.pos)){
				return true;
			}
		}
	}
	return false;
}

function checkMove(game, move){
	var piece = getPiece(game.board, move.start);
	if(!piece)
		return false;
	if(piece.color != game.turn)
		return false;
	var moves = getMoves(game, piece);
	for(var otherMove of moves){
		if(veq(otherMove.stop, move.stop))
			return true;
	}
	return false;
}

function gameState(game){
	if(allMoves(game, false).length == 0)
		return isUnderThreat(game.board, game.kings[game.turn]) ? 'checkmate' : 'stalemate';
	return 'playing';
}

// AI ---------------------------------

function revertMove(game, change){
	var move = change.move;
	setPiece(game.board, move.start, change.moved);
	setPiece(game.board, move.stop, change.deleted);
	if(change.moved.kind == 'king')
		game.kings[change.moved.color] = change.moved;
	game.turn = change.turn;
}

function change(game, move){
	return {move : move, moved : deepClone(getPiece(game.board, move.start)), deleted : deepClone(getPiece(game.board, move.stop)), turn : game.turn};
}

function moveValuePair(game, move, weights){
	var changes = change(game, move);
	performMove(game, move);
	game.turn = opposite(game.turn);
	var value = totalRating(game, weights, false);
	revertMove(game, changes);
	return [value, move];
}

function sortMoves(game, moves, weights){
	moves = moves.map((move) => moveValuePair(game, move, weights)); //Sort moves by heuristic value
	moves.sort((a,b) => b[0] - a[0]);
	moves = moves.map((pair) => pair[1]);
	return moves.slice(0, Math.min(weights.movesPerPosition, moves.length));
}

function alphaBeta(game, depth, maximizing, weights, alpha, beta, transposition){
	alpha = alpha || -Infinity;
	beta = beta || Infinity;
	transposition = transposition || {};

	var moves = allMoves(game, true);

	moves = sortMoves(game, moves, weights);

	var bestScore = maximizing ? -Infinity : Infinity;
	var bestMove;

	for(var move of moves){

		var changes = change(game, move);
		performMove(game, move);

		var score;
		var key = JSON.stringify(game) + depth;

		if(transposition[key]){
			//console.log('Repeat state!');
			score = transposition[key];
		}
		else {
			if(depth == 0){
				game.turn = opposite(game.turn);
				score = totalRating(game, weights, true);
			} else {
				var result = alphaBeta(game, depth - 1, !maximizing, weights, alpha, beta, transposition);
				score = result.score;
			}
			transposition[key] = score;
		}
		

		if(maximizing && score > bestScore || !maximizing && score < bestScore){
			bestScore = score;
			bestMove = move;
			if(maximizing)
				alpha = Math.max(alpha, score);
			else
				beta = Math.min(beta, score);
			if(alpha >= beta){
				revertMove(game, changes);
				break;
			}
		}

		revertMove(game, changes);
	}
	return {move : bestMove, score : bestScore};
}

// Board Assessment ---------------------------------

var pieceValues = {king: 99999, pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9};

function pieceRating(game, piece){
	return pieceValues[piece.kind] * (game.turn == piece.color ? 1 : -1);
}

function mobilityRating(game, piece){
	// if(piece.kind == 'king' )//|| piece.kind == 'pawn')
	// 	return 0;
	var mobilityValue = piece.kind == 'king' ? 2 : pieceValues[piece.kind];
	var moveCount = getMoves(game, piece, true).length;
	//return pieceValues[piece.kind] * (game.turn == piece.color ? 1 : -1) * moveCount;
	return mobilityValue * (game.turn == piece.color ? 1 : -1) * moveCount;
}

function threatRating(game, piece, weights){
	var sum = 0;
	var threats = getMoves(game, piece, true, true);
	for(var threat of threats){
		var victim = getPiece(game.board, threat.stop);
		var pieceWeight = victim.kind == 'king' ? weights.kingDefense : pieceValues[victim.kind];
		sum += pieceWeight * (game.turn == victim.color ? -weights.defense : weights.agression);
	}
	return sum;
	// if(isUnderThreat(game.board, piece)){
	// 	var pieceWeight = piece.kind == 'king' ? weights.kingDefense : pieceValues[piece.kind];
	// 	return pieceWeight * (game.turn == piece.color ? -weights.defense : weights.agression);
	// }
	// return 0;
}

var defaults = {mobility : 0.1, agression : 0.2, defense : 0.8, kingDefense : 18, noise : 0, movesPerPosition : 5};
function totalRating(game, weights, isLeaf){
	weights = weights || defaults;
	var sum = Math.random() * weights.noise;
	for(var x = 0; x < 8; x++){
		for(var y = 0; y < 8; y++){
			var pos = vec(x,y);
			var piece = getPiece(game.board, pos);
			if(piece){
				sum += pieceRating(game, piece) + mobilityRating(game, piece) * weights.mobility;
				if(isLeaf)
					sum += threatRating(game, piece, weights);
			}
		}
	}
	return sum;
}

try { module.exports = 
	{game : game, setup : setup, getMoves : getMoves, getPiece : getPiece, 
	playerMovePiece : playerMovePiece, performMove : performMove, checkMove : checkMove, 
	gameState : gameState, revec : revec, alphaBeta : alphaBeta}; }
	catch(err) {}