import React from 'react';
import createReactClass from 'create-react-class';
import GradingMenuBar from './GradingMenuBar.js';
import Assignment from './Assignment.js';
import TeacherInteractiveGrader from './TeacherInteractiveGrader.js';
import { GradesView, SimilarDocChecker } from './TeacherInteractiveGrader.js';
import AssignmentEditorMenubar from './AssignmentEditorMenubar.js';
import { ModalWhileGradingMenuBar } from './GradingMenuBar.js';
import DefaultHomepageActions from './DefaultHomepageActions.js';
import { assignmentReducer } from './Assignment.js';
import { gradingReducer } from './TeacherInteractiveGrader.js';
import { calculateGradingOverview } from './TeacherInteractiveGrader.js';
import { makeBackwardsCompatible, convertToCurrentFormat } from './TeacherInteractiveGrader.js';

// Application modes
var APP_MODE = 'APP_MODE';
var EDIT_ASSIGNMENT = 'EDIT_ASSIGNMENT';
var GRADE_ASSIGNMENTS = 'GRADE_ASSIGNMENTS';
var MODE_CHOOSER = 'MODE_CHOOSER';

var VIEW_GRADES = 'VIEW_GRADES';

var SIMILAR_DOC_CHECK = 'SIMILAR_DOC_CHECK';

// Actions to change modes
var GO_TO_MODE_CHOOSER = 'GO_TO_MODE_CHOOSER';
var SET_ASSIGNMENTS_TO_GRADE = 'SET_ASSIGNMENTS_TO_GRADE';
// action properties
var NEW_STATE = 'NEW_STATE';

// Assignment properties
var ASSIGNMENT_NAME = 'ASSIGNMENT_NAME';
var SET_ASSIGNMENT_NAME = 'SET_ASSIGNMENT_NAME';
var PROBLEMS = 'PROBLEMS';

// state for google drive auto-save
// action
var SET_GOOGLE_DRIVE_STATE = 'SET_GOOGLE_DRIVE_STATE';
// Property name and possible values
var GOOGLE_DRIVE_STATE = 'GOOGLE_DRIVE_STATE';
var SAVING = 'SAVING';
var ALL_SAVED = 'ALL_SAVED';
var DIRTY_WORKING_COPY = 'DIRTY_WORKING_COPY';
var PENDING_SAVES = 'PENDING_SAVES';
var INCREMENT_PENDING_SAVES = 'INCREMENT_PENDING_SAVES';
var VALUE = 'VALUE';

// used to swap out the entire content of the document, for opening
// a document from a file
var SET_ASSIGNMENT_CONTENT = 'SET_ASSIGNMENT_CONTENT';

// Problem properties
var PROBLEM_NUMBER = 'PROBLEM_NUMBER';
var STEPS = 'STEPS';
var CONTENT = "CONTENT";

// TODO - make this more efficient, or better yet replace uses with the spread operator
// to avoid unneeded object creation
function cloneDeep(oldObject) {
    return JSON.parse(JSON.stringify(oldObject));
}

function genID() {
    return Math.floor(Math.random() * 200000000);
}

function updateAutoSave(docType, docName, appState) {
    // TODO - validate this against actual saved data on startup
    // or possibly just re-derive it each time?
    var saveIndex = window.localStorage.getItem("save_index");
    if (saveIndex) {
        saveIndex = JSON.parse(saveIndex);
    }
    if (!saveIndex) {
        saveIndex = { "TEACHERS" : {}, "STUDENTS" : {}};
    }
    if (saveIndex[docType][appState["DOC_ID"]]) {
        var toDelete = saveIndex[docType][appState["DOC_ID"]];
    }
    var doc = JSON.stringify(appState);
    // TODO - escape underscores (with double underscore?) in doc name, to allow splitting cleanly
    // and presenting a better name to users
    // nvm will just store a key with spaces
    var dt = new Date();
    var dateString = datetimeToStr(dt);
    var saveKey = "auto save " + docType.toLowerCase() + " " + docName + " " + dateString;
    window.localStorage.setItem(saveKey, doc);
    saveIndex[docType][appState["DOC_ID"]] = saveKey;
    window.localStorage.setItem("save_index", JSON.stringify(saveIndex));
    if (toDelete !== undefined) {
        window.localStorage.removeItem(toDelete);
    }
}

function datetimeToStr(dt) {
    return dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate() + " " + dt.getHours() +
                    ":" + ("00" + dt.getMinutes()).slice(-2) + ":" + ("00" + dt.getSeconds()).slice(-2) + "." + dt.getMilliseconds();
}

let currentNumPendingSaves;
let currentSaveState ;
let currentAppMode;
let currentlyGatheringUpdates;
function autoSave() {
    var appState = window.store.getState();

    if (appState[APP_MODE] === EDIT_ASSIGNMENT) {

        var problems = appState[PROBLEMS];
        console.log(JSON.stringify(problems));
        console.log(appState);
        var googleId = window.store.getState()["GOOGLE_ID"];
        if (googleId) {

            let previousSaveState = currentSaveState;
            currentSaveState = appState[GOOGLE_DRIVE_STATE];

            let previousPending = currentNumPendingSaves;
            currentNumPendingSaves = appState[PENDING_SAVES];

            let previousAppMode = currentAppMode;
            currentAppMode = appState[APP_MODE];

            console.log("previous: " + previousAppMode);
            console.log("current: " + currentAppMode);
            console.log("previous: " + previousSaveState);
            console.log("current: " + currentSaveState);
            console.log("previous:" + previousPending);
            console.log("current:" + currentNumPendingSaves);
            // filter out changes to state made in this function, saving state, pending save count
            // also filter out the initial load of the page when a doc opens
            if (previousSaveState !== currentSaveState || previousPending !== currentNumPendingSaves
               || previousAppMode !== currentAppMode) {
                // ignore the changes to the drive state, none of them should trigger auto-save events
                // escpecially as we kick off an update to this value within this function
                return;
            }
            console.log("auto saving problems");
            // try to bundle together a few updates, wait 2 seconds before calling save. assume
            // some more keystrokes are incomming
            if (window.store.getState()[GOOGLE_DRIVE_STATE] !== SAVING) {
                window.store.dispatch({type : SET_GOOGLE_DRIVE_STATE, GOOGLE_DRIVE_STATE : SAVING});
            }
            if (currentlyGatheringUpdates) {
                console.log("skipping new auto-save because currently gathering updates");
                return;
            }
            currentlyGatheringUpdates = true;
            window.store.dispatch({type : INCREMENT_PENDING_SAVES, VALUE : 1});
            setTimeout(function() {
                currentlyGatheringUpdates = false;
                console.log("update in google drive:" + googleId);
                var assignment = JSON.stringify(
                            { PROBLEMS : makeBackwardsCompatible(window.store.getState())[PROBLEMS]});
                assignment = new Blob([assignment], {type: 'application/json'});
                window.updateFileWithBinaryContent(
                    window.store.getState()[ASSIGNMENT_NAME] + '.math',
                    assignment,
                    googleId,
                    'application/json',
                    function() {
                        window.store.dispatch({type : INCREMENT_PENDING_SAVES, VALUE : -1});
                        if (window.store.getState()[PENDING_SAVES] === 0) {
                            window.store.dispatch(
                                {type : SET_GOOGLE_DRIVE_STATE, GOOGLE_DRIVE_STATE : ALL_SAVED});
                        }
                    }
                );
            }, 1000);
        } else {
            // check for the initial state, do not save this
            if (problems.length === 1) {
                var steps = problems[0][STEPS];
                if (steps.length === 1 && steps[0][CONTENT] === '') {
                    return;
                }
            }
            console.log("auto saving problems");
            updateAutoSave("STUDENTS", appState["ASSIGNMENT_NAME"], appState);
        }
    } else if (appState[APP_MODE] === GRADE_ASSIGNMENTS) {
        // TODO - add input for assignment name to teacher page
        updateAutoSave("TEACHERS", appState["ASSIGNMENT_NAME"], appState);
    } else {
        // current other states include mode chooser homepage and view grades "modal"
        return;
    }
}

function rootReducer(state, action) {
    console.log(action);
    console.log(state);
    try {
    if (state === undefined || action.type === GO_TO_MODE_CHOOSER) {
        return {
            APP_MODE : MODE_CHOOSER
        };
    } else if (action.type === "NEW_ASSIGNMENT") {
        return {
            ...assignmentReducer(),
            "DOC_ID" : genID(),
            PENDING_SAVES : 0,
            GOOGLE_DRIVE_STATE : DIRTY_WORKING_COPY,
            APP_MODE : EDIT_ASSIGNMENT
        };
    } else if (action.type === "SET_GLOBAL_STATE") {
        return action.newState;
    } else if (action.type === SET_ASSIGNMENT_NAME) {
        return { ...state,
                 ASSIGNMENT_NAME : action[ASSIGNMENT_NAME]
        }
    } else if (action.type === SET_GOOGLE_DRIVE_STATE) {
        return { ...state,
                 GOOGLE_DRIVE_STATE: action[GOOGLE_DRIVE_STATE]
        }
    } else if (action.type === INCREMENT_PENDING_SAVES) {
        var existing = state[PENDING_SAVES];
        console.log("is pending a not a number:" +  isNaN(existing));
        existing = isNaN(existing) ? 0 : existing;
        return { ...state,
                 PENDING_SAVES: existing + action[VALUE]
        }
    } else if (action.type === SET_ASSIGNMENTS_TO_GRADE) {
        // TODO - consolidate the defaults for filters
        // TODO - get similar assignment list from comparing the assignments
        // overview comes sorted by LARGEST_ANSWER_GROUPS_SIZE ascending (least number of common answers first)
        var overview = calculateGradingOverview(action[NEW_STATE][PROBLEMS]);
        return {
            ...action[NEW_STATE],
            "DOC_ID" : genID(),
            GOOGLE_ID: action.GOOGLE_ID,
            "GRADING_OVERVIEW" : overview,
            "CURRENT_PROBLEM" : overview[PROBLEMS][0][PROBLEM_NUMBER],
            APP_MODE : GRADE_ASSIGNMENTS,
        }
    } else if (action.type === SET_ASSIGNMENT_CONTENT) {
        // TODO - consider serializing DOC_ID and other future top level attributes into file
        // for now this prevents all opened docs from clobbering other suto-saves
        return {
            APP_MODE : EDIT_ASSIGNMENT,
            PROBLEMS : action.PROBLEMS,
            GOOGLE_ID: action.GOOGLE_ID,
            ASSIGNMENT_NAME : action[ASSIGNMENT_NAME],
            PENDING_SAVES : 0,
            GOOGLE_DRIVE_STATE : ALL_SAVED,
            "DOC_ID" : genID() 
        };
    } else if (state[APP_MODE] === EDIT_ASSIGNMENT) {
        return {
            ...assignmentReducer(state, action),
            APP_MODE : EDIT_ASSIGNMENT,
            PENDING_SAVES : 0
        }
    } else if (state[APP_MODE] === GRADE_ASSIGNMENTS
        || state[APP_MODE] === SIMILAR_DOC_CHECK
        || state[APP_MODE] === VIEW_GRADES) {
       return {
            ...gradingReducer(state, action)
        };
    } else {
        return state;
    }
    } finally {
        console.log("finished");
        console.log(action);
    }
}

var FreeMath = createReactClass({
  render: function() {
    // TODO - figure out how to best switch between teacher and
    // student mode rendering
    var wrapperDivStyle = {
        padding:"0px 30px 0px 30px",
        "margin-left":"auto",
        "margin-right": "auto",
        height:"100%"
    };
    /*
    return (
            <div style={wrapperDivStyle}>
                <AssignmentEditorMenubar value={this.props.value}/>
                <div style={{display:"inline-block", width:"100%"}}>
                    <ExprComparisonTests />
                </div>
            </div>
            );
    */

    if (this.props.value[APP_MODE] === EDIT_ASSIGNMENT) {
        return (
            <div style={{wrapperDivStyle, width : "100%"}}>
                <AssignmentEditorMenubar value={this.props.value}/>
                <div style={{display:"inline-block", width:"100%"}}>
                    <Assignment value={this.props.value}/>
                </div>
            </div>
        );
    } else if (this.props.value[APP_MODE] === GRADE_ASSIGNMENTS) {
        return (
            <div style={{...wrapperDivStyle, width : "95%" }}>
                <GradingMenuBar value={this.props.value} />
                <TeacherInteractiveGrader value={this.props.value}/>
            </div>
        );
    } else if (this.props.value[APP_MODE] === MODE_CHOOSER) {
        return (
            <DefaultHomepageActions />
        );
    } else if (this.props.value[APP_MODE] === VIEW_GRADES) {
        return (
            <div style={{...wrapperDivStyle, width : "80%" }}>
                <ModalWhileGradingMenuBar />
                <GradesView value={this.props.value} />
            </div>
        );
    } else if (this.props.value[APP_MODE] === SIMILAR_DOC_CHECK) {
        return (
            <div style={{...wrapperDivStyle, width : "95%" }}>
                <ModalWhileGradingMenuBar />
                <div style={{margin:"60px 0px 30px 0px"}}>
                <SimilarDocChecker value={this.props.value} />
                </div>
            </div>
        );
    } else  {
        alert(this.props.value);
    }
  }
});

export {FreeMath as default, autoSave, rootReducer, cloneDeep, genID};
