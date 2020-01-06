import React from 'react';
import createReactClass from 'create-react-class';
import { saveAs } from 'file-saver';
import './App.css';
import LogoHomeNav from './LogoHomeNav.js';
import { makeBackwardsCompatible, convertToCurrentFormat } from './TeacherInteractiveGrader.js';
import { LightButton, HtmlButton } from './Button.js';

// Assignment properties
var ASSIGNMENT_NAME = 'ASSIGNMENT_NAME';
var PROBLEMS = 'PROBLEMS';
var PROBLEM_NUMBER = 'PROBLEM_NUMBER';

// editing assignmnt mode actions
var SET_ASSIGNMENT_NAME = 'SET_ASSIGNMENT_NAME';
// used to swap out the entire content of the document, for opening
// a document from a file
var SET_ASSIGNMENT_CONTENT = 'SET_ASSIGNMENT_CONTENT';

var GOOGLE_ID = 'GOOGLE_ID';
var SET_GOOGLE_ID = 'SET_GOOGLE_ID';
// state for google drive auto-save
// action
var SET_GOOGLE_DRIVE_STATE = 'GOOGLE_DRIVE_STATE';
// Property name and possible values
var GOOGLE_DRIVE_STATE = 'GOOGLE_DRIVE_STATE';
var SAVING = 'SAVING';
var ALL_SAVED = 'ALL_SAVED';
var DIRTY_WORKING_COPY = 'DIRTY_WORKING_COPY';

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
    saveAs(blob, window.store.getState()[ASSIGNMENT_NAME] + '.math');
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
export function openAssignment(serializedDoc, filename, discardDataWarning, driveFileId) {
    // this is now handled at a higher level, this is mostly triggered by onChange events of "file" input elements
    // if the user selects "cancel", I want them to be able to try re-opening again. If they pick the same file I
    // won't get on onChange event without resetting the value, and here I don't have a reference to the DOM element
    // to reset its value
    //if (discardDataWarning && !window.confirm("Discard your current work and open the selected document?")) {
    //    return;
    //}

    try {
        var newDoc = JSON.parse(serializedDoc);
        // compatibility for old files, need to convert the old proerty names as
        // well as add the LAST_SHOWN_STEP
        newDoc = convertToCurrentFormat(newDoc);
        window.store.dispatch({type : SET_ASSIGNMENT_CONTENT,
            PROBLEMS : newDoc[PROBLEMS], GOOGLE_ID: driveFileId,
            ASSIGNMENT_NAME : removeExtension(filename)});
    } catch (e) {
        console.log(e);
        alert("Error reading the file, Free Math can only read files with " +
              "a .math extension that it creates. If you saved this file " +
              "with Free Math please send it to developers@freemathapp.org " +
              "to allow us to debug the issue.");
    }
}

// read a file from the local disk, pass an onChange event from a "file" input type
// http://www.htmlgoodies.com/beyond/javascript/read-text-files-using-the-javascript-filereader.html
export function readSingleFile(evt, discardDataWarning) {
    //Retrieve the first (and only!) File from the FileList object
    var f = evt.target.files[0];

    if (f) {
        var r = new FileReader();
        r.onload = function(e) { 
            var contents = e.target.result;
            openAssignment(contents, f.name, discardDataWarning);
        }
        r.readAsText(f);
    } else {
        alert("Failed to load file");
    }
}

var AssignmentEditorMenubar = createReactClass({
    render: function() {
        const responseGoogle = (response) => {
            console.log(response);
        }
        var saveStateMsg = '';
        var googleId = window.store.getState()[GOOGLE_ID];
        if (googleId) {
            var state = this.props.value[GOOGLE_DRIVE_STATE];
            if (state === ALL_SAVED) saveStateMsg = "All changes saved in Drive";
            else if (state === SAVING) saveStateMsg = "Saving in Drive...";
        }
        return (
            <div className="menuBar">
                <div style={{width:1024,marginLeft:"auto", marginRight:"auto"}} className="nav">
                    <LogoHomeNav /> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

                    <div className="navBarElms" style={{float: "right", verticalAlign:"top", lineHeight : 1}}>
                        <span style={{margin : "0px 15px 0px 15px"}}>
                            {saveStateMsg}</span>
                        Filename &nbsp;&nbsp;
                        <input type="text" id="assignment-name-text" size="35"
                               name="assignment name"
                               value={this.props.value[ASSIGNMENT_NAME]}
                               onChange={
                                    function(evt) {
                                        window.store.dispatch(
                                            { type : SET_ASSIGNMENT_NAME,
                                              ASSIGNMENT_NAME : evt.target.value});
                            }}
                        />&nbsp;&nbsp;

                        <LightButton text="Save to Device" onClick={
                            function() { saveAssignment() }} /> &nbsp;&nbsp;&nbsp;

                        <HtmlButton
                            className="fm-button-light"
                            onClick={
                                function() {

                                    var assignment = JSON.stringify(
                                                { PROBLEMS : makeBackwardsCompatible(
                                                             window.store.getState())[PROBLEMS]
                                                }
                                    );
                                    assignment = new Blob([assignment], {type: 'application/json'});
                                    var googleId = window.store.getState()[GOOGLE_ID];
                                    if (googleId) {
                                        console.log("update in google drive:" + googleId);
                                        window.updateFileWithBinaryContent(
                                            window.store.getState()[ASSIGNMENT_NAME] + '.math',
                                            assignment,
                                            googleId,
                                            'application/json',
                                            function() {
                                                window.store.dispatch(
                                                    { type : SET_GOOGLE_DRIVE_STATE,
                                                        GOOGLE_DRIVE_STATE : ALL_SAVED});
                                            }
                                        );
                                    } else {
                                        window.createFileWithBinaryContent(
                                            window.store.getState()[ASSIGNMENT_NAME] + '.math',
                                            assignment,
                                            'application/json',
                                            function(driveFileId) {
                                                window.store.dispatch({type : SET_GOOGLE_ID,
                                                    GOOGLE_ID: driveFileId,
                                                });
                                                window.store.dispatch(
                                                    { type : SET_GOOGLE_DRIVE_STATE,
                                                        GOOGLE_DRIVE_STATE : ALL_SAVED});
                                            }
                                        );
                                    }
                            }}
                            content={(
                                    <div style={{display: "inline-block"}}>
                                        <div style={{float: "left", paddingTop: "4px"}}>Save to&nbsp;</div>
                                         <img style={{paddingTop: "2px"}}
                                                src="images/google_drive_small_logo.png"
                                                alt="google logo" />
                                    </div>
                            )} />&nbsp;&nbsp;&nbsp;
                    </div>
                </div>
            </div>
        );
  }
});

export {AssignmentEditorMenubar as default, removeExtension };
