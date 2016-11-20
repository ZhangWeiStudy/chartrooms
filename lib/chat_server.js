var socketio = require("socket.io");
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};


exports.listen = function(server) {

    io = socketio.listen(server);
    io.set("log level", 1);
    io.sockets.on("connection", function(socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
    });

    // put it into chatroom Lobby when the user connection
    joinRoom(socket, "Lobby");

    // deal user messages and create chatrooms or change chatrooms
    handleMessageBroadcasting(socket, nickNames);
    handleNameChangeAttempts(socket, nickNames, namesUsed);
    handleRoomJoining(socket);

    // when user request for rooms,offer user used chatrooms list
    socket.on("rooms", function() {

        socket.emit("rooms", io.sockets.manager.rooms);

    });

    // when the user off the chat ,clear the connection
    handleClientDisconnection(socket, nickNames, namesUsed);

}

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    // create a new name
    var name = "Guest" + guestNumber;
    // save name
    nickNames[socket.id] = name;
    // let user know its name
    socket.emit("nameResult", {
        success: true,
        name: name
    });
    // save already used user names
    namesUsed.push(name);
    // count numbers+1
    return guestNumber + 1;
}

// join in chatroom
function joinRoom(socket, room) {
    // user go into the room
    socket.join(room);
    // record user's currentRoom
    currentRoom[socket.id] = room;
    // let user know that they come into new room    
    socket.emit("joinResult", { room: room });

    // let the user who is already in rooms knows that there is new user come in
    socket.broadcast.to(room).emit("message", {
        text: nickNames[socket.id] + " has joined " + room + "."
    });

    var usersInRoom = io.sockets.clients(room);

    // summary users in room
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = "Users currently in " + room + ":";
        for (var index in usersInRoom) {
            var userSocketId = usersInRoom[index].id;
            if (usersSocketId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ", ";
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        // summary other users's info to the new user
        usersInRoomSummary += ".";
        socket.emit("message", { text: usersInRoomSummary });
    }
}

// change user name 
function handleNameChangeAttempts(socket, nickNames, namesUsed) {

    socket.on("nameAttempt", function(name) {
        if (name.indexOf("Guest") == 0) {
            socket.emit("nameResult", {
                success: false,
                message: 'Names cannot begin with "Guest".'
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex];
                socket.emit("nameResult", {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit("message", {
                    text: previousName + " is now known as  " + name + "."
                });
            } else {
                socket.emit("nameResult", {
                    success: false,
                    message: name + " is already in use."
                });
            }
        }
    });

}

// send message
function handleMessageBroadcasting(socket) {
    socket.on("message", function(message) {
        socket.broadcast.to(message.room).emit("message", {
            text: nickNames[socket.id] + ": " + message.text
        });
    });
}

// create room
function handleRoomJoining(socket) {
    socket.on("join", function(room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

// disconnnection
function handleClientDisconnection(socket) {
    socket.on("disconnect", function() {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}