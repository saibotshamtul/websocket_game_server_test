//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript
var http = require("http"),
    ws = require("nodejs-websocket")
function dir(x) {
    a = [x]
    for (var b in x) {
        if (typeof x[b] !== 'function') {
            a.push([b, x[b]])
        } else {
            a.push([b, x[b].toString().slice(0, x[b].toString().indexOf("{"))])
        }
    }
    return a
}

var Game = function(name, connection){
    if (!(name in server.allGames)){
        server.allGames[name] = {
            Nicks:[],
            Matches:{},
            Conns:[]
        }
    }
    this.name = name
    game = server.allGames[name]
    game.Conns.push(connection)
    
    match = connection.match
    if (!(match in game.Matches)){
        game.Matches[match] = []
    }
    game.Matches[match].push(connection)
}
Game.prototype.setNick = function(nick){
    game = server.allGames[this.name]
    if (game.Nicks.indexOf(nick) > -1) {
        return false
    } else {
        game.Nicks.push(nick)
        return true
    }
}
Game.prototype.removeConnection = function(connection){
    game = server.allGames[this.name]
    //remove the nickname
    if (game.Nicks.indexOf(connection.nick) > -1){
        game.Nicks.splice(game.Nicks.indexOf(connection.nick))
    } else {
        console.log([connection.nick,'not in game.Nicks'].join(" "))
    }
    //remove the connection
    if (game.Conns.indexOf(connection) > -1){
        game.Conns.splice(game.Conns.indexOf(connection))
    } else {
        console.log([connection.nick,'not in game.Conns'].join(" "))
    }
    //remove from the match
    match = game.Matches[connection.match]
    if (!(match === undefined)){
        if (match.indexOf(connection) > -1){
            match.splice(match.indexOf(connection))
        } else {
            console.log([connection.nick,'not in game.Matches[',connection.match,']'].join(" "))
        }
        if (match.length === 0){
            delete game.Matches[connection.match]
        }
    } else {
        console.log(['Match',connection.match,'is undefined.'].join(" "))
    }
}
Game.prototype.changeMatch = function(connection, matchname){
    game = server.allGames[this.name]
    currentmatchname = connection.match
    currentmatch = game.Matches[currentmatchname]
    
    //broadcast that this connection has left its current match
    broadcast(connection, "-", connection.nick)
    
    //remove this connection from the current match
    currentmatch.splice(currentmatch.indexOf(connection))
    
    //see if by leaving the match, the match is empty
    if (currentmatch.length === 0){
        delete game.Matches[currentmatchname]
    }
    
    //see if the match exists. If not, create it.
    if (!(matchname in game.Matches)){
        game.Matches[matchname] = []
    }
    
    //add this connection to the desired match
    game.Matches[matchname].push(connection)
    //change it here, otherwise it will cause a fatal error
    //when we broadcast
    connection.match = matchname
    
    //broadcast that this connection had joined the new match
    broadcast(connection, "+", connection.nick)
    return true
}

var server = ws.createServer(function(connection) {
    //onInit
    connection.game = null
    connection.match = 'Unmatched'
    connection.nick = null
    connection.isAlive = 0
    connection.living = 0
    console.log(server.connections.length)
    //1st message must be gamename
    connection.sendText("Game Name:")
    //onText
    connection.on("text", function(str) {
        if (connection.game === null){
            connection.game = new Game(str, connection)
            //2nd message must be nickname
            connection.sendText("Username:")
        } else {
            if (connection.nick === null){
                if (connection.game.setNick(str)) {
                    connection.nick = str
                } else {
                    connection.sendText(["Username", str, "is already in use. Please choose another nickname."].join(" "))
                }
            } else {
                game = server.allGames[connection.game.name]
                
                // if we're here, we should handle the messages
                // that each connection sends.
                // This should include handling match-creation / choice
                // and game updates
                // ? ask for list of matches ?
                // @match asks for a list of users in that match
                // = choose a match          =+-
                //   game status update        (deprecated)
                // 0 ask for current game    0
                // 1 ask for nickname        1
                // 2 ask for matchname       2
                cmd = str.slice(0, 1)
                txt = str.slice(1)
                
                if (cmd === "0"){
                     connection.sendText(connection.game.name)
                 }
                if (cmd === "1"){
                    connection.sendText(connection.nick)
                }
                if (cmd === "2"){
                    connection.sendText(connection.match)
                }
//                 if (cmd === "3"){
//                     connection.sendPing("this is some test data")
//                 }
                
                if (cmd === "?"){
                    connection.sendText(
                        Object.keys(game.Matches).map(
                            function(x){
                                a= {}
                                a[x]=game.Matches[x].length
                                return JSON.stringify(a)
                            }
                        ).toString()
                    )
                }
                if (cmd === "@"){
                    if (txt in game.Matches){
                        match = game.Matches[txt]
                        connection.sendText(
                            Object.keys(match).map(
                                function(x){
                                    return match[x].nick
                                }
                            ).toString()
                        )
                    } else {
                        connection.sendText(["Match",txt,"doesn't exist."].join(" "))
                    }
                }
                
                if (cmd ==="="){
                    if (connection.game.changeMatch(connection, txt)){
                        connection.sendText(['New match:',txt].join(" "))
                    } else {
                        connection.sendText(["Could not join match", str, ". Please choose another match."].join(" "))
                    }
                }
                
                if ("012?@=".indexOf(cmd) === -1){
                    //connection.sendText([cmd,txt].join(""))
                    broadcast(connection,cmd,txt)
                }
                
//                 connection.sendText(
//                     ["Txt:",
//                      str,
//                      "\nYour Game:",
//                      JSON.stringify(connection.game),
//                      "\nYou Match:",
//                      connection.match,
//                      "\nThisGame's Nicks:",
//                      game.Nicks,
//                      "\nThisGame's Matches:",
//                      Object.keys(game.Matches),
//                      "\nThisGame's Conns:",
//                      Object.keys(game.Conns).map(function(x){return game.Conns[x].nick}),
//                      "\nThisMatch size:",
//                      game.Matches[connection.match].length
//                     ].join(" "))
            }
        }
    })
    connection.on("close", function(code, reason) {
        connection.game.removeConnection(connection)
    })
    connection.on("pong", function(data){
        //connection.sendText(["Pong:",data].join(" "))
        connection.living = connection.isAlive
    })
})

server.allGames = {}

server.listen(8086)
console.log(("=".repeat(50) + "\n").repeat(3))
console.log("Listening on port 8086")

function broadcast(conn, cmd, msg) {
    /*server.connections.forEach(function(connection) {
        if (connection.gamename === game)
            connection.sendText(str)
    })*/
//     games[conn.gamename][conn.matchname].forEach(
//         function(connection) {
//             connection.sendText([cmd, msg].join(""))
//         }
//     )
    game = server.allGames[conn.game.name]
    match = game.Matches[conn.match]
    nick = conn.nick
    
    //console.log(cmd, msg, conn.nick, conn.match)
    
    if (match.length>0){
        match.forEach(
            function(conne){
                if (conne.nick !== nick){
                    conne.sendText([nick, ":", cmd, msg].join(""))
                }
            }
        )
    }
}

function checkAlive(){
    server.connections.forEach(function(connection){
        //timeout the connection after 5 seconds
        if ((connection.isAlive - connection.living) > 5){
            connection.close()
        } else {
            connection.isAlive = connection.isAlive + 1 
            connection.sendPing()
        }
    })
}
setInterval(checkAlive, 1000)
