import './style.css';

import $ from 'jquery';        //make jquery() available as $
import Meta from './meta.js';  //bundle the input to this program

//default values
const DEFAULT_REF = '_';       //use this if no ref query param
const N_UNI_SELECT = 4;        //switching threshold between radio & select
const N_MULTI_SELECT = 4;      //switching threshold between checkbox & select

/*************************** Utility Routines **************************/

/** Return `ref` query parameter from window.location */
function getRef() {
    const url = new URL(window.location);
    const params = url.searchParams;
    return params && params.get('ref');
}

/** Return window.location url with `ref` query parameter set to `ref` */
function makeRefUrl(ref) {
    const url = new URL(window.location);
    url.searchParams.set('ref', ref);
    return url.toString();
}

/** Return a jquery-wrapped element for tag and attr */
function makeElement(tag, attr={}) {
    const $e = $(`<${tag}/>`);
    Object.entries(attr).forEach(([k, v]) => $e.attr(k, v));
    return $e;
}

/** Given a list path of accessors, return Meta[path].  Handle
 *  occurrences of '.' and '..' within path.
 */
function access(path) {
    const normalized = path.reduce((acc, p) => {
        if (p === '.') {
            return acc;
        }
        else if (p === '..') {
            return acc.length === 0 ? acc : acc.slice(0, -1)
        }
        else {
            return acc.concat(p);
        }
    }, []);
    return normalized.reduce((m, p) => m[p], Meta);
}

/** Return an id constructed from list path */
function makeId(path) { return ('/' + path.join('/')); }

function getType(meta) {
    return meta.type || 'block';
}

/** Return a jquery-wrapped element <tag meta.attr>items</tag>
 *  where items are the recursive rendering of meta.items.
 *  The returned element is also appended to $element.
 */
function items(tag, meta, path, $element) {
    const $e = makeElement(tag, meta.attr);
    (meta.items || []).
    forEach((item, i) => render(path.concat('items', i), $e));
    $element.append($e);
    return $e;
}

/************************** Event Handlers *****************************/

//@TODO

function validateForm(event, meta) {

    let i = 0;

    $("*").on("blur change",function(e){

        if (e.target.nextSibling && e.target.nextSibling.id){

            let w = "#" + e.target.nextSibling.id||"";
            const chkre = $(':checkbox').serializeArray();
            if (chkre.length === 0 && e.target.type === 'checkbox'){
                w = w.replace(/\//g, '\\/') + '-err';

                $(w).text("The field Primary Colors must be specified")

            }else if (e.target.value === "" && meta.items[i]){

                w = w.replace(/\//g, '\\/');
                if (meta.items[i].required === true) {
                    $(w).text("The field " + meta.items[i].text + " must be specified")
                }
            }else if (e.target.value !== "" && meta.items[i] && meta.items[i].chkFn){

                w = w.replace(/\//g, '\\/');

                if (!meta.items[i].chkFn(e.target.value)) {
                    if (meta.items[i].errMsgFn){
                        $(w).text(meta.items[i].errMsgFn(e.target.value, meta.items[i], meta))
                    }else {
                        $(w).text("invalid value " + e.target.value)
                    }
                }
            }
            i++;
        }

    });

    $('.error').empty();
}

function onBlurErrorHandler(meta) {

    $(document).ready(function(){

        $('input').on("blur change",function(evt) {
            if(evt.target.tagName !== 'BUTTON'){
                let q = evt.target.id.slice(-1);
                let w = "#" + evt.target.nextSibling.id||"";
                let r = "#" + evt.target.id||"";
                r = r.replace(/\//g, '\\/');
                w = w.replace(/\//g, '\\/');
                if (evt.target.value === "" && meta.items[q]){

                    if (meta.items[q] && meta.items[q].required === true && $('label' + r).text().slice(-1) === '*') {
                        $(w).text("The field " + $('label' + r).text().replace("*", "") + " must be specified")
                    }
                }else if (evt.target.value !== "" && meta.items[q] && meta.items[q].chkFn){

                    if (!meta.items[q].chkFn(evt.target.value)) {
                        if (meta.items[q].errMsgFn){
                            $(w).text(meta.items[q].errMsgFn(evt.target.value, meta.items[q], meta))
                        }else {
                            $(w).text("invalid value " + evt.target.value)
                        }
                    }
                }
                //q++;
            }
        });

        $('*').focus(function(evt) {
            if(evt.target.tagName !== 'BUTTON'){

                if (evt.target.nextSibling.tagName === 'DIV' && evt.target.nextSibling.value !== ""){
                    evt.target.nextSibling.textContent = "";
                } else{

                    $('.error')[evt.target.nextSibling.id.slice(-1)].textContent = "";
                }
            }
        });
    });
}

/********************** Type Routine Common Handling *******************/

//@TODO


/***************************** Type Routines ***************************/

//A type handling function has the signature (meta, path, $element) =>
//void.  It will append the HTML corresponding to meta (which is
//Meta[path]) to $element.

function block(meta, path, $element) { items('div', meta, path, $element); }

function form(meta, path, $element) {
    const $form = items('form', meta, path, $element);
    onBlurErrorHandler(meta);
    $form.submit(function(event) {
        event.preventDefault();
        const $form = $(this);
        //@TODO

        $(document).ready(function(){
            $('input,select,textarea', $form).trigger('blur');
            $('select', $form).trigger('change');
        });
        validateForm(event, meta)
        let x = 0;
        $(document).ready(function(){
            // Loop through each div element with the class box
            $(".error").each(function(){
                // Test if the div element is empty

                if(!$(this).is(":empty")){
                    console.log("ya its non empty")
                    x++;
                }
                console.log("loop X: " + x)
            });

            console.log("doc X: " + x)
            if (x === 0){
                const resultsArray = {};
                const multiWidgetArray = [];
                const primaryColoursArray = [];
                const results = $form.serializeArray();
                const resultsInJson = JSON.parse(JSON.stringify(results));
                let j = 0, k = 0;
                for (let i = 0; i < results.length; i++){
                    if (results[i].name === 'multiSelect'){

                        multiWidgetArray[j] = results[i].value;
                        j++;
                    }

                    if (results[i].name === 'primaryColors'){

                        primaryColoursArray[k] = results[i].value;
                        k++;
                    }
                }

                for (let i = 0; i < results.length; i++){

                    if (results[i].name === 'multiSelect'){

                        resultsArray[resultsInJson[i].name] = multiWidgetArray;
                    }else if(results[i].name === 'primaryColors'){
                        resultsArray[resultsInJson[i].name] = primaryColoursArray;
                    }else {
                        resultsArray[resultsInJson[i].name] = resultsInJson[i].value;
                    }
                }
                console.log(JSON.stringify(resultsArray, null, 2));
            }
        });

        console.log("X: " + x)

    });
}

function header(meta, path, $element) {
    const $e = makeElement(`h${meta.level || 1}`, meta.attr);
    $e.text(meta.text || '');
    $element.append($e);
}

function input(meta, path, $element) {
    //@TODO

    const text = meta.required ? meta.text.concat('*') : meta.text;

    if (meta.attr.id === undefined){
        makeId(path);
    }
    const $emptyDivElement = makeElement('div', {class: 'empty'});
    $element.append(makeElement('label', {id: makeId(path)}).text(text)).append($emptyDivElement);
    $emptyDivElement.append(makeElement(meta.type, {type: meta.subType || '', name: meta.attr.name, id: makeId(path), placeholder: meta.attr.placeholder || ''}))
    $emptyDivElement.append(makeElement('div', {class: 'error', id: makeId(path).concat('-err')}))
}

function link(meta, path, $element) {
    const parentType = getType(access(path.concat('..')));
    const { text='', ref=DEFAULT_REF } = meta;
    const attr = Object.assign({}, meta.attr||{}, { href: makeRefUrl(ref) }); // 2nd step
    $element.append(makeElement('a', attr).text(text)); // 3rd step with Button element
}

function multiSelect(meta, path, $element) {
    //@TODO

    const text = meta.required ? meta.text.concat('*') : meta.text;

    if (meta.attr.id === undefined){
        makeId(path);
    }
    const $emptyDivElement = makeElement('div');
    $element.append(makeElement('label', { name: meta.attr.name, id: makeId(path)}).text(text)).append($emptyDivElement);

    if (meta.items.length > (N_MULTI_SELECT || 4)){
        const $selectElement = makeElement('select', { multiple: 'multiple', name: meta.attr.name});
        (meta.items).forEach((item) => {
            $selectElement.append(makeElement('option', {value: item.key}).text(item.text));
        });
        $emptyDivElement.append($selectElement);
        $emptyDivElement.append(makeElement('div', {class: 'error', id: makeId(path).concat('-err')}))
    } else {
        const $fieldSetElement = makeElement('div', {class: 'fieldset'});
        (meta.items).forEach((item) => {
            $fieldSetElement.append(makeElement('input', {name: meta.attr.name, value: item.key, type: 'checkbox'})).append(makeElement('label', {id: makeId(path)}).text(item.key));
        });
        $emptyDivElement.append($fieldSetElement);
        $emptyDivElement.append(makeElement('div', {class: 'error', id: makeId(path).concat('-err')}))
    }
}

function para(meta, path, $element) { items('p', meta, path, $element); }

function segment(meta, path, $element) {
    if (meta.text !== undefined) {
        $element.append(makeElement('span', meta.attr).text(meta.text)); // 1st step
    }
    else {
        items('span', meta, path, $element);
    }
}


function submit(meta, path, $element) {
    //@TODO
    $element.append(makeElement('div'));
    const attr = Object.assign({}, meta.attr||{});
    $element.append(makeElement('button', {type: 'submit'}).text(meta.text || 'Submit'));
}

function uniSelect(meta, path, $element) {
    //@TODO

    const text = meta.required ? meta.text.concat('*') : meta.text;

    if (meta.attr.id === undefined){
        makeId(path);
    }
    const $emptyDivElement = makeElement('div');
    $element.append(makeElement('label', { name: meta.attr.name, id: makeId(path)}).text(text)).append($emptyDivElement);

    if (meta.items.length > (N_UNI_SELECT || 4)){
        const $selectElement = makeElement('select', meta.attr);
        (meta.items).forEach((item) => {
            $selectElement.append(makeElement('option', {value: item.key}).text(item.text));
        });
        $emptyDivElement.append($selectElement);
        $emptyDivElement.append(makeElement('div', {class: 'error', id: makeId(path).concat('-err')}))
    } else {
        const $fieldSetElement = makeElement('div', {class: 'fieldset'});
        (meta.items).forEach((item, i) => {
            $fieldSetElement.append(makeElement('input', {name: meta.attr.name, value: item.key, type: 'radio'})).append(makeElement('label', {id: makeId(path)}).text(item.key));
        });
        $emptyDivElement.append($fieldSetElement);
        $emptyDivElement.append(makeElement('div', {class: 'error', id: makeId(path).concat('-err')}))
    }
}


//map from type to type handling function.
const FNS = {
    block,
    form,
    header,
    input,
    link,
    multiSelect,
    para,
    segment,
    submit,
    uniSelect,
};

/*************************** Top-Level Code ****************************/

function render(path, $element=$('body')) {
    const meta = access(path);
    if (!meta) {
        $element.append(`<p>Path ${makeId(path)} not found</p>`);
    }
    else {
        const type = getType(meta);
        const fn = FNS[type];
        if (fn) {
            fn(meta, path, $element);
        }
        else {
            $element.append(`<p>type ${type} not supported</p>`);
        }
    }
}

function go() {
    const ref = getRef() || DEFAULT_REF;
    render([ ref ]);
}

go();