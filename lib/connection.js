var _ = require("underscore");
var irc = require("irc");
var client_settings = require("../settings/client");
var get_plugin = require("./plugins").get_plugin;

var connection = function(io) {
  io.sockets.on("connection", function (socket) {
    var clients = {};

    socket.emit("settings", client_settings);

    socket.on("connect", function(data) {
      var client = new irc.Client(data.server, data.nick, {
        channels: ["#test_metro"]
      });

      clients[data.server] = client;

      client.on("raw", function(message) {
        socket.emit("raw", _.extend(message, {client_server: client.opt.server}));
      });
    });

    socket.on("say", function(data) {
      var client = clients[data.server];
      client.say(data.target, data.text);
    });

    socket.on("command", function(data) {
      var client = clients[data.server];
      var args;
      if (data.command) {
        args = data.command.split(" ");
      } else {
        args = [""];
      }

      // If the arguments don't include the channel we add it
      var includeChannel = function(args) {
        if(args.length > 1) {
          return args[1].indexOf("#") !== 0 ? args.splice(1,0,data.target) : args;
        } else if (args.length === 1) {
          return args.splice(1,0,data.target);
        } else {
          return args;
        }
      };

      switch (args[0].toLowerCase()) {
        case "join":
          client.join(args[1]);
          break;

        case "leave":
          client.part(data.target, _.rest(args).join(" "));
          break;

        case "me":
          // Send a sentence
          client.action(data.target, args.slice(1).join(" "));
          break;

        case "msg":
          client.say(args[1], args.slice(2).join(" "));
          break;

        case "part":
        case "kick":
        case "topic":
          client.send.apply(client, includeChannel(args));
          break;

        case "admin":
          client.send.apply(client, args);
          break;

        default:
          client.send.apply(client, args);
          break;
      }
    });

    socket.on("raw", function(data) {
      var client = clients[data.server];
      client.send.apply(this, data.args);
    });

    socket.on("disconnect", function() {
      _.each(clients, function(val, key, list) {
        // Clean up server connections
        val.disconnect();
        delete list[key];
      });
    });

    socket.on("add_plugin", function(data) {
      get_plugin(data.plugin, function() {
        socket.emit("plugin_added", {plugin: data.plugin});
      });
    });
  });
};

module.exports = connection;