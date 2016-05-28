(function(ext) {
    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {};

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        return {status: 2, msg: 'Ready'};
    };

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
        ]
    };

    // Register the extension
    ScratchExtensions.register('angustools extension', descriptor, ext);
})({});


