(function(ext) {
    debug = function(text) {
	d = new Date()
	iso = d.toISOString()
	console.log(iso +" DEBUG: " + text);
    }
    
    debug('angustools');

    server='raspberrypi.belmont.abercrombie-family.org';


    server_url = 'http://' + server + '/robot/api';
    
    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {
	debug("angustools shutdown");
    };

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
	debug("_getStatus()");
	
	// Could try to connect to server here,
	var ok = 0;
	var ok_msg = "Can't connect to " + server_url;
	
        $.ajax({url: server_url + "/status",
		async: false,
		dataType: 'text',
		success: function(data) {
		    debug(data);
                    ok = 2;
		    ok_msg = "Ready";
		}
               });

	debug("status: " + ok + ", msg: " + ok_msg);
        return {status: ok, msg: ok_msg};
    };


    ext.stop_all = function() {
	debug("stop_all()");
        $.post(server_url + "/stop_all",
	       {},
               function(data) {debug(data);}
        );
    }
    
    set_motor = function(motor, speed) {
	debug("set_motor(" + motor + ", " + speed + ")");

        $.post(server_url + "/set_motor/" + motor,
	       {speed: speed},
               function(data) {
		   debug(data);
               }
              );
    }
    

    ext.set_motor_1 = function(speed) {
	set_motor(1, speed)
    }

    ext.set_motor_2 = function(speed) {
	set_motor(2, speed)
    }

    ext.ticker = function(ticker, callback) {
        $.ajax({
            url: 'http://finance.google.com/finance/info?client=ig&q=' + ticker,
            dataType: 'jsonp',
            success: function(data) {
		console.log(data);
                callback(data[0].l);
            }
        });
    };

    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            ['R', 'stock quote for %s', 'ticker', 'GOOG'],
            [' ', 'Stop all motors', 'stop_all'],
            [' ', 'Set motor 1 speed to %n', 'set_motor_1', '50'],
            [' ', 'Set motor 2 speed to %n', 'set_motor_2', '50'],
        ]
    };

    // Register the extension
    ScratchExtensions.register('angustools extension', descriptor, ext);
})({});


