import React from 'react';
import createReactClass from 'create-react-class';
import { saveAs } from 'file-saver';
import './App.css';
import LogoHomeNav from './LogoHomeNav.js';
import { convertToCurrentFormat } from './TeacherInteractiveGrader.js';
import { LightButton } from './Button.js';

var gapi = window.gapi;

// Assignment properties
var ASSIGNMENT_NAME = 'ASSIGNMENT_NAME';
var PROBLEMS = 'PROBLEMS';
var PROBLEM_NUMBER = 'PROBLEM_NUMBER';
// NOTE: NOT USED IN CURRENT VERSION, ADDED WHILE SAVING FOR BACKWARDS COMPATIBILITY
var LAST_SHOWN_STEP = 'LAST_SHOWN_STEP';
var STEPS = 'STEPS';

// editing assignmnt mode actions
var SET_ASSIGNMENT_NAME = 'SET_ASSIGNMENT_NAME';
// used to swap out the entire content of the document, for opening
// a document from a file
var SET_ASSIGNMENT_CONTENT = 'SET_ASSIGNMENT_CONTENT';

function saveAssignment() {
    var atLeastOneProblemNumberNotSet = false;
    window.store.getState()[PROBLEMS].forEach(function(problem, index, array) {
        if (problem[PROBLEM_NUMBER].trim() === "") {
            atLeastOneProblemNumberNotSet = true;
        }
    });
    if (atLeastOneProblemNumberNotSet) {
        if (! window.confirm("At least one problem is missing a problem number. "
                            + "These are needed for your teacher to grade your "
                            + "assignment effectively. It is reccomended you "
                            + "cancel the save and fill them in.")) {
            return;
        }
    }

    var blob = new Blob([JSON.stringify({
        PROBLEMS : makeBackwardsCompatible(window.store.getState())[PROBLEMS]})],
        {type: "text/plain;charset=utf-8"});
    var filename = window.store.getState()[ASSIGNMENT_NAME] + '.math'

    //AIzaSyC8-uGZtfvY-iZkOEORGq2ZpyBTlvRPI94

    var metadata = {
        'name': filename, // Filename at Google Drive
        'mimeType': 'text/plain', // mimeType at Google Drive
        //'parents': ['### folder ID ###'], // Folder ID at Google Drive
    };

    // 1. Load the JavaScript client library.
    gapi.load('client', start);

    var accessToken = gapi.auth2.getToken().access_token; // Here gapi is used for retrieving the access token.
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', blob);

    var xhr = new XMLHttpRequest();
    xhr.open('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.responseType = 'json';
    xhr.onload = () => {
        console.log(xhr.response.id); // Retrieve uploaded file ID.
    };
    xhr.send(form);
    //saveAs(blob, filename);
}

function start() {
  // 2. Initialize the JavaScript client library.
  gapi.client.init({
    'apiKey': 'AIzaSyC8-uGZtfvY-iZkOEORGq2ZpyBTlvRPI94',
    // Your API key will be automatically added to the Discovery Document URLs.
    'discoveryDocs': ['https://people.googleapis.com/$discovery/rest'],
    // clientId and scope are optional if auth is not required.
    'clientId': '412119895810-tji5c4tj6so2jmde8k3t1l3kaui5g4ca.apps.googleusercontent.com',
    'scope': 'profile',
  }).then(function() {
    // 3. Initialize and make the API request.
    return gapi.client.people.people.get({
      'resourceName': 'people/me',
      'requestMask.includeField': 'person.names'
    });
  }).then(function(response) {
    console.log(response.result);
  }, function(reason) {
    console.log('Error: ' + reason.result.error.message);
  });
};

function makeBackwardsCompatible(newDoc) {
    newDoc[PROBLEMS].forEach(function (problem) {
        problem[LAST_SHOWN_STEP] = problem[STEPS].length - 1;
    });
    return newDoc; 
}

function removeExtension(filename) {
    // remove preceding directory (for when filename comes out of the ZIP directory)
    // inside of character class slash is not a special character,
    // this is highlighted incorrectly in some editors, but the escaping this slash
    // fires the no-useless-escape es-lint rule
    filename = filename.replace(/[^/]*\//, "");
    // actually remove extension
    filename = filename.replace(/\.[^/.]+$/, "");
    return filename;
}

// TODO - consider giving legacy docs an ID upon opening, allows auto-save to work properly when
// opening older docs
export function openAssignment(serializedDoc, filename, discardDataWarning) {
    // this is now handled at a higher level, this is mostly triggered by onChange events of "file" input elements
    // if the user selects "cancel", I want them to be able to try re-opening again. If they pick the same file I
    // won't get on onChange event without resetting the value, and here I don't have a reference to the DOM element
    // to reset its value
    //if (discardDataWarning && !window.confirm("Discard your current work and open the selected document?")) {
    //    return;
    //}

    var newDoc = JSON.parse(serializedDoc);
    // compatibility for old files, need to convert the old proerty names as
    // well as add the LAST_SHOWN_STEP
    newDoc = convertToCurrentFormat(newDoc);
    window.store.dispatch({type : SET_ASSIGNMENT_CONTENT, PROBLEMS : newDoc[PROBLEMS]});
    window.store.dispatch({type : SET_ASSIGNMENT_NAME, ASSIGNMENT_NAME : removeExtension(filename)});
}

// read a file from the local disk, pass an onChange event from a "file" input type
// http://www.htmlgoodies.com/beyond/javascript/read-text-files-using-the-javascript-filereader.html
export function readSingleFile(evt, discardDataWarning) {
    //Retrieve the first (and only!) File from the FileList object
    var f = evt.target.files[0];

    if (f) {
            var r = new FileReader();
            r.onload = function(e) {
                try {
                    var contents = e.target.result;
                    openAssignment(contents, f.name, discardDataWarning);
                } catch (e) {
                    console.log(e);
                    alert("Error reading the file, Free Math can only read files with a .math extension that it creates. If you saved this file with Free Math please send it to developers@freemathapp.org to allow us to debug the issue.");
                }
        }
        r.readAsText(f);
    } else {
        alert("Failed to load file");
    }
}

var AssignmentEditorMenubar = createReactClass({
  render: function() {
        return (
            <div className="menuBar">
                <div style={{width:1024,marginLeft:"auto", marginRight:"auto"}} className="nav">
                    <LogoHomeNav /> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

                    <div className="navBarElms" style={{float: "right", verticalAlign:"top", lineHeight : 1}}>
                        Filename &nbsp;&nbsp;
                        <input type="text" id="assignment-name-text" size="35" name="assignment name" value={this.props.value[ASSIGNMENT_NAME]} onChange={
                            function(evt) {
                                window.store.dispatch({type : SET_ASSIGNMENT_NAME, ASSIGNMENT_NAME : evt.target.value});
                            }}
                        />&nbsp;&nbsp;

                        <LightButton text="save" onClick={
                            function() { saveAssignment() }} /> &nbsp;&nbsp;&nbsp;
                    </div>
                </div>
            </div>
        );
  }
});

export default AssignmentEditorMenubar;
