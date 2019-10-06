var clientId = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com';
var apiKey = '*******************************************';
var scopes = 'https://www.googleapis.com/auth/gmail.modify';

function handleClientLoad() {
    gapi.client.setApiKey(apiKey);
    window.setTimeout(checkAuth, 1);
}

function checkAuth() {
    gapi.auth.authorize(
        {
            client_id: clientId,
            scope: scopes,
            immediate: true
        },
        handleAuthResult
    );
}

function handleAuthClick() {
    gapi.auth.authorize(
        {
            client_id: clientId,
            scope: scopes,
            immediate: false
        },
        handleAuthResult
    );
    return false;
}

function handleAuthResult(authResult) {
    if (authResult && !authResult.error) {
        loadGmailApi();
        $("#authorize-button").remove();
        $(".table-inbox").removeClass("hidden");
    } else {
        $("#authorize-button").removeClass("hidden");
        $("#authorize-button").on("click", function () {
            handleAuthClick();
        });
    }
}

function loadGmailApi() {
    gapi.client.load("gmail", "v1", displayInbox);

}

function displayInbox() {

    var request = gapi.client.gmail.users.messages.list({
        'userId': 'me',
        'labelIds': 'INBOX',
        'subject': 'You got a new booking!',
        'q': 'somemail@gmail.com',
        'labelFilterAction': 'include',
        'maxResults': 1000
    });

    request.execute(function (response) {
        $.each(response.messages, function () {
            var messageRequest = gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': this.id
            });


            messageRequest.execute(appendMessageRow);

        });
    });
}
function appendMessageRow(message) {  
    customerDataDaemon(message);

    $('.table-inbox tbody').append(
        '<tr id="row' + message.id + '">\
                <td>'+ strip_html_tags(getBody(message.payload)).split('Customer Info').pop().split('Service Info')[0] + '</td>\
                <td>\
                  <a href="#message-modal-' + message.id +
        '" data-toggle="modal" class ="text-primary" id="message-link-' + message.id + '">' +
        getHeader(message.payload.headers, 'Subject') +
        '</a>\
                </td>\
                <td>'+ strip_html_tags(getBody(message.payload)).split('Service Info').pop().split('Thanks')[0] + '</td>\
                <td>'+ strip_html_tags(getBody(message.payload)).split('When:').pop().split('Where:')[0] + '</td>\
                <td>'+ getHeader(message.payload.headers, 'Date') + '</td>\<td ><button name="complete" id="' + message.id + '" class="btn btn-outline-success btn_complete">Done</button></td>\</tr>'

    );
    $('body').append(
        '<div class="modal fade" id="message-modal-' + message.id +
        '" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">\
                <div class="modal-dialog modal-lg">\
                  <div class="modal-content">\
                    <div class="modal-header">\
                      <h4 style ="color:blue;"class="modal-title" id="myModalLabel">' +
        getHeader(message.payload.headers, 'Subject') +
        '</h4>\
                      <button type="button"\
                              class="close"\
                              data-dismiss="modal"\
                              aria-label="Close">\
                        <span aria-hidden="true">&times;</span></button>\
                    </div>\
                    <div class="modal-body">\
                      <iframe id="message-iframe-'+ message.id + '" srcdoc="<p>Loading...</p>">\
                      </iframe>\
                    </div>\
                  </div>\
                </div>\
              </div>'
    );

    $('#message-link-' + message.id).on('click', function () {
        var ifrm = $('#message-iframe-' + message.id)[0].contentWindow.document;
        $('body', ifrm).html(getBody(message.payload));
    });

    $(document).on('click', '.btn_complete', function () {
        var button_id = $(this).attr("id");
        $('#row' + button_id + '').remove();
        var request = gapi.client.gmail.users.messages.trash({
            'userId': 'me',
            'id': this.id,
        });
        request.execute();
    });
}

function getHeader(headers, index) {
    var header = '';
    $.each(headers, function () {
        if (this.name === index) {
            header = this.value;
        }
    });
    return header;
}
function getBody(message) {
    var encodedBody = '';
    if (typeof message.parts === 'undefined') {
        encodedBody = message.body.data;
    }
    else {
        encodedBody = getHTMLPart(message.parts);
    }
    encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    return decodeURIComponent(escape(window.atob(encodedBody)));
}
function getHTMLPart(arr) {
    for (var x = 0; x <= arr.length; x++) {
        if (typeof arr[x].parts === 'undefined') {
            if (arr[x].mimeType === 'text/html') {
                return arr[x].body.data;
            }
        }
        else {
            return getHTMLPart(arr[x].parts);
        }
    }
    return '';
}

function modifyMessage(userId, messageId, labelsToAdd, labelsToRemove, callback) {

}

// insert customer details into firebase database on message load
var customerDataDaemon = function (message) {
    var customernumb = [];
    var name = strip_html_tags(getBody(message.payload)).split('Customer Info').pop().split('Email:')[0].trim().slice(6);
    var email = strip_html_tags(getBody(message.payload)).split('Email:').pop().split('Phone Number:')[0].trim();
    var contact = strip_html_tags(getBody(message.payload)).split('Phone Number:').pop().split('Service Info')[0].trim();
    console.log(name, email, contact);

    var date = Math.floor(Date.now() / 1000);
    var rootRef = firebase.database().ref();
    var storesRef = rootRef.child("Customers/");
    var newStoreRef = storesRef.push();
    if (name == "" || email == "" || contact == "") {
        console.log("No field can be empty, please fill all fields.");
    }
    else {
        const ref = firebase.database().ref("/Customers");
        ref.on(
            "value",
            function (snapshot) {
                snapshot.forEach(function (childSnap) {
                    var childKey = childSnap.key;
                    var childDta = childSnap.val();
                    customernumb.push(childDta.Contact);
                });
                console.log(customernumb);
                console.log(contact.toString());
                if (customernumb.includes(contact.toString())) {
                    console.log("Customer details exists already.");
                    customernumb.length = 0;
                } else {
                    newStoreRef.set({
                        Name: name,
                        Email: email,
                        Contact: contact,
                        EntryDate: date.toString()
                    });
                    storesRef.limitToLast(1).once("child_added", snap => {
                        var childKey = snap.key;
                        var childData = snap.val();
                        //console.log(childKey, childData);
                        $("#dynamic_field_customers").append(
                            '<tr><td> <input readonly type="text" name="service[]" value="' +
                            timeConverter(parseInt(childData.EntryDate)) +
                            '" class="form-control name_list" placeholder="service"></td><td> <input readonly type="text" name="price[]" value="' +
                            childData.Name +
                            '" id="price" class="form-control price_list" placeholder="price"></td> <td> <input readonly type="text" name="staff[]" value="' +
                            childData.Email +
                            '" class="form-control name_list" placeholder="staff"></td> <td> <input readonly type="text" name="service[]" value="' +
                            childData.Contact +
                            '" class="form-control name_list" placeholder="date"></td></tr>'
                        );
                        console.log("Customer information entry successful.");
                        customernumb.length = 0;
                    });

                }
            },
            function (errorObject) {
                console.log("The read failed: " + errorObject.code);
            }
        );
    }
};

// make convert from html string to string
function strip_html_tags(str) {
    if ((str === null) || (str === ''))
        return false;
    else
        str = str.toString();
    return str.replace(/<[^>]*>/g, '');
}

//convert unix ts to date
function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time =
        date + " " + month + " " + year + " " + hour + ":" + min + ":" + sec;
    return time;
}