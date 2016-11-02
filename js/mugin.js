/*
 * mugin.js 
 *
 *  Copyright (C) 2016 Marco Pasi <mf.pasi@gmail.com> 
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 * v0.1 160518
 * v0.2 160520
 * v0.3 160525
 * v0.4 160530
 * v0.5 160601
 * v0.5.1 160613
 * v0.5.2 160613
 * v0.5.3 160930
 * TODO: 
 *  1. directional links DONE v0.2
 *  2. double links      DONE v0.2
 *  3. improved metadata DONE v0.3
 *  4. JSON input/output DONE v0.4
 *  5. editable metadata DONE v0.5
 *  5a. filtering        DONE v0.5.1
 *  5b. submit json      DONE v0.5.2
 *  6. graph bidimensional sorting
 *  6a. add sortable info to nodes
 *  7. multiple entries per link
 *  8. save/load layouts DONE v0.5.3
 */

/* Constants */
var PI = 3.1415;

/* Types:
 *  0. available tools: done
 *  1. demonstrated to be relevant, but no available tools: todo
 *  2. potentially relevant: maybe
 */  
var NTYPES = 3,
    TYPE_DONE = 0,
    TYPE_TODO = 1,
    TYPE_MAYBE= 2,
    TYPE_CLASS=["done", "todo", "maybe"],
    TYPE_DESCRIPTION=["Tools available", "Relevant", "Potential"];

/* Flows:
 *  0. Connect: The two data types have been used together to perform a scientific task
 *  1. Inform: One data type informs the other to generate scientific data
 */
var NFLOWS = 2,
    FLOW_CONNECT = 0,
    FLOW_INFORM  = 1,
    FLOW_DESCRIPTION = ["Connect (<->)", "Inform (->)"];

/* Pilots:
 *  0. Pilot 7.1
 *  1. Pilot 7.2
 *  2. Pilot 7.3
 */
var NPILOT = 3,
    PILOT_1 = 1,
    PILOT_2 = 2,
    PILOT_3 = 4,
    PILOTS = [PILOT_1, PILOT_2, PILOT_3],
    PILOT_DESCRIPTION = ["7.1", "7.2", "7.3"];

/* Logging */
var LOG_LEVEL = 2,
    LOG_DEBUG = 0,
    LOG_INFO  = 1,
    LOG_WARN  = 2,
    LOG_ERROR = 3,
    LOG_FATAL = 4,
    LOG_MESSAGE = ["Debug","Info","Warn","Error","Fatal"];

/* Toolbox */
var TOOL_SIZE = 40,
    TOOLmv = 10,
    TOOLmh = 10;

/* Legend */
var LEGEND_WID = 20,
    LEGEND_MRG = 10,
    LEGEND_HIG = 20,
    LEGEND_POSx= 15,
    LEGEND_POSy= 10;

/* Configuration */
var width = 600,
    height = 500,
    transitionDuration = 1000; // ms

/* General utility functions */
Array.prototype.findAll = function(searchElement) {
    var indices = [];
    var idx = this.indexOf(searchElement);
    while (idx != -1) {
        indices.push(idx);
        idx = this.indexOf(searchElement, idx + 1);
    }
    return indices;
}

Array.prototype.clean = function(deleteValue) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == deleteValue) {
            this.splice(i, 1);
            i--;
        }
    }
    return this;
};

function capitalize(string) {
    return string.substr(0, 1).toUpperCase() + string.substr(1);
}

function message() {
    var level = arguments[0];
    var args = Array.prototype.slice.call(arguments, 1);
    args = [LOG_MESSAGE[level]+":"].concat(args);
    if(level >= 3)
        window.alert(args.join(" "));
    if(level >= LOG_LEVEL)
        console.log.apply(console, args);
}

function errorHandle(error) {
    message(LOG_ERROR, error);
    return -1;
}

function updateobject(obj, obj2) {
    /*
     * Deep copy all contents of obj2 to obj, overwriting
     * when required.
     */
    for (var prop in obj2) {
        var val = obj2[prop];
        if (typeof val == "object") { // this also applies to arrays or null!
            if(! (prop in obj))
                obj[prop] = null
            updateobject(obj[prop], val);
        } else
            obj[prop] = val;
    }
}

/*
 * CopyObject:
 * An object implementing a copy constructor and the ability
 * of being updated with the contents of another object.
 */
var CopyObject = function(object) { // copy constructor
    $.extend(true, this, object);
}
CopyObject.prototype.update = function(obj2) {
    /*
     * Update object with all fields in =obj2=,
     * overwriting when required.
     */
    return $.extend(true, this, obj2);
}

/*
 * HyperLink: A hypertext link
 *
 * - text: the text to be displayed
 * - link: a valid URL
 */ 
var HyperLink = function(object) {
    this.text = undefined;
    this.link = undefined;
    CopyObject.call(this, object);
    if(this.text == undefined)
        this.text = this.link;
}
HyperLink.prototype = Object.create(CopyObject.prototype);
HyperLink.prototype.constructor = HyperLink;

/*
 * Node: A graph node
 *
 * - name: the name of the node; used to distinguish nodes.
 * - description: a meaningful description of the node.
 */ 
var Node = function(object) {
    this.name = undefined;
    this.description = undefined;
    CopyObject.call(this, object);
}
Node.prototype = Object.create(CopyObject.prototype);
Node.prototype.constructor = Node;
Node.prototype.update = function(node2) {
    CopyObject.prototype.update.call(this, node2);
    message(LOG_DEBUG, "Updated node: ", this);
    return 0;
}


/*
 * Link: A graph link
 *
 * - source:  the source node for the link (see Note 1)
 * - target:  the target node for the link (see Note 1)
 * - description:  a meaningful description of the link
 * - flow:  the flow of the link (see Note 2)
 * - type:  the link type (see Note 3)
 * - reference:  a list of literary references with links to
 *   the source material (see HyperLink)
 * - tools:  a list of pertinent available software tools (see
 *   HyperLink).
 * - pilot:  the pilot project(s) to which this link applies
 * - links:  a list of relevant web pages (see HyperLink)
 * - weight:  number of links that share the same endpoints
 * - notes:  a free text field for comments
 *
 * Note 1: source and target can be expressed in 3 ways:
 *  - the index of the node in the parent Graph's list of nodes
 *  - the name of the node (name property of the node)
 *  - the node object from the parent Graph's list of nodes
 *
 * Note 2: there are 2 flow types defined:
 *   0. Connect: The two data types have been used together to
 *      perform a scientific task 
 *   1. Inform: One data type informs the other to generate
 *      scientific data
 *
 * Note 3: there are 3 link types defined:
 *   0. Pertinent software tools are available.
 *   1. The connections has been demonstrated to be
 *      scientifically relevant in the literature, but software 
 *      tools are still unavailable.
 *   2. The connection has been discussed as potentially
 *      relevant for MuG.
 */ 
var Link = function(object) {
    this.source = undefined;
    this.target = undefined;
    this.description = undefined;
    this.flow = undefined;
    this.type = undefined;
    this.reference = undefined;
    this.tools = undefined;
    this.pilot = undefined;
    this.links = undefined;
    this.notes = undefined;
    CopyObject.call(this, object);
}
Link.prototype = Object.create(CopyObject.prototype);
Link.prototype.constructor = Link;
Link.prototype.update = function(link2) {
    CopyObject.prototype.update.call(this, link2);
    message(LOG_DEBUG, "Updated link: ", this);
    return 0;
}

Link.prototype.get_nodeids = function() {
    /*
     * Get ids of a link's source and target nodes
     */
    var src = typeof this.source == "object" ? this.source.index : this.source,
        trg = typeof this.target == "object" ? this.target.index : this.target;
    return [src, trg];
}

Link.prototype.get_undirected_linkid = function() {
    /*
     * Get an undirected unique number for links.
     */
    var ids = this.get_nodeids(),
        src = ids[0],
        trg = ids[1];
    return Math.min(src,trg)*1e10+Math.max(src,trg);
}

Link.prototype.get_directed_linkid = function() {
    /*
     * Get a directed unique number for links.
     */
    var ids = this.get_nodeids(),
        src = ids[0],
        trg = ids[1];
    return src*1e10+trg;
}

/*
 * Graph: a collection of nodes and links.
 * Graph contains methods to add/remove/update links in a form
 * which is compatible with subsequent viewing with D3.js.
 *
 * Methods:
 *  - addnode(node):   adds a node
 *  - addlink(link):   adds a link
 *  - delnode(node):   adds a node
 *  - dellink(link):   adds a link
 *  - calculate_weights(link, deleted):  update the weight
 *    (i.e. the number of links with same endpoints) of all 
 *    links that share endpoints with the argument.
 *  - to_json():  return a JSON string representing the graph.
 */

var Graph = function() {
    this.nodes = [];
    this.links = [];
}

Graph.prototype.addnode = function(node) {
    /*
     * Add a node to the graph, and return the index of the
     * added node or -1 upon failure. If a node with the same
     * name exists, return its index. 
     *
     * Arguments:
     *   - node: a structure containing the node
     *     name and description.
     *
     */
    if(node.name == undefined)
        return -1;
    var nodelist = this.nodes.map(function(d){return d.name;});
    if(nodelist.indexOf(node.name) >= 0)
        return nodelist.indexOf(node.name);

    node = new Node(node);
    return this.nodes.push(node) - 1;
}

Graph.prototype.addlink = function(link) {
    /*
     * Add a link to the graph; see Link.
     * Returns the index of the added link, or -1 upon failure.
     * By convention, if link.source or link.target are
     * strings, then a node with that name is added.
     */
    link = new Link(link);
    // Add nodes
    if(link.source == undefined)
        return -1;

    var ids = link.get_nodeids(),
        src = ids[0],
        trg = ids[1];
    if (typeof link.source == "string")
        src = this.addnode({name: link.source});
    if (typeof link.target == "string")
        trg = this.addnode({name: link.target});

    message(LOG_DEBUG, "Graph: addlink: ", link.source, link.target, src, trg);

    // Turn around when flow is negative
    if(link.flow == -1) {
        var tmp = src;
        src=trg;
        trg=tmp;
        link.flow = 1;
    }

    link.source = src;
    link.target = trg;

    // Correct weights
    var weight = this.calculate_weights(link);
    if(weight < 0) // skip
        return -1;
    link.weight = weight;

    // Parse references & links if text (CSV)
    if(typeof link.reference == "string") {
        var refs = link.reference.split(";");
        var links = link.links.split(";");
        link.reference = 
            refs.map(function(ref, i) {
                return new HyperLink({link: links[i], text: ref});
            });
        link.links = links.slice(refs.length);
    }

    // Parse links if text (CSV)
    link.links = link.links.map(function(l,i) {
        if(typeof l == "string")
            return new HyperLink({link: l, text: l});
        else
            return new HyperLink(l);
    });

    // Parse tools if text (CSV)
    if(typeof link.tools == "string")
        link.tools = [{link: link.tools,
                       text: link.tools}];

    link.tools = link.tools.map(function(l,i) {return new HyperLink(l);});

    return this.links.push(link) - 1;
}

Graph.prototype.delnode = function(node)  {
    /*
     * Delete a node and all links to and from it
     */
    var self = this;
    var idx = this.nodes.indexOf(node);
    if(idx < 0)
        return -1;
    this.nodes.splice(idx, 1);
    // remove links
    this.links.filter(function(link, i) {
        return link.source == node || link.target == node;
    }).map(function(link){self.dellink(link);});
    return idx;
}

Graph.prototype.dellink = function(link) {
    /*
     * Delete a link
     */
    var idx = this.links.indexOf(link);
    if(idx < 0)
        return -1;
    this.links.splice(idx, 1);
    this.calculate_weights(link, true);
    return idx;
}

Graph.prototype.calculate_weights = function(link, del=false) {
    /*
     * Recalculate the weights of all links between the
     * same edges as =link=, considering that =link= has
     * just been added, or deleted if =del= is true.
     * Fail if the added link has a duplicate (identical
     * source, target and flow).
     * Returns the link's weight, or -1 upon failure.
     */
    var self = this;
    var linklist = this.links.map(function(link){return link.get_undirected_linkid();}),
        ulinkid = link.get_undirected_linkid(),
        dlinkid = link.get_directed_linkid(),
        ulinkis = linklist.findAll(ulinkid),
        dlinkis = ulinkis.map(function(i){ // search within undirected links
            return self.links[i].get_directed_linkid();
        }).findAll(dlinkid)
        .map(function(i){return ulinkis[i];});
        weight = 1,
        delta_weight = del?-1:1;

    if(!del &&
       dlinkis.length > 0 &&
       this.links[dlinkis[0]].flow == link.flow)
        return -1; // skip duplicate

    if(ulinkis.length > 0) {
        // Assume weights are up to date
        weight = this.links[ulinkis[0]].weight + delta_weight;

        // Update all weights
        ulinkis.forEach(function(l) {
            self.links[l].weight = weight;
        });
    }
    return weight;
}

Graph.prototype.to_json = function() {
    /*
     * Export the graph to json
     */
    var skippers = "x y rx ry index weight px py fixed conf nodelist linklist".split(" ");
    return JSON.stringify(
        this,
        function(key, value) {
            if(skippers.indexOf(key) >= 0)
                return undefined;
            // transform objects to names
            if(key == "source" || key == "target")
                return value.name;
            return value
        }, true);
}

Graph.prototype.filter_links = function(criteria, callback, negate = false) {
    /*
     * Call =callback= on all links that match specified =criteria=.
     *
     * Arguments
     *     - criteria: Array of functions with signature:
     *          fun(link, i, links)
     *       where link is a Link, i is its index in the list of
     *       links. The functions return boolean values, which are
     *       combined using AND. criteria can contain nested Arrays
     *       of boolean-returning functions with the same signature
     *       as above: these are evaluated first and combined using
     *       OR: this allows mixing AND and OR logic in the criteria.
     *     - callback: function to call, with signature:
     *          fun(link, i, filtered_links)
     *       where link is a Link, i is its index in the list of
     *       selected link (filtered_links)
     *     - negate: boolean to define whether filter_links
     *       matches links for which criteria return true or false.
     *
     */

    function criteria_apply(link, l_index, links, criteria, negate, subreducer) {
        /*
         * Combine results of criteria on link using subreducer (see Array.reduce).
         */
        return criteria.map(function(criterium, c_index, criteria) {
            var current = undefined;
            if(Array.isArray(criterium))
                current = criteria_apply(link, l_index, links,
                                         criterium, negate, subreducer).reduce(subreducer, false);
            else
                current = criterium(link, l_index, links);
            if(negate)
                current = !current;
            return current;
        });
    }

    this.links.filter(function(link, l_index) {
        var crit = criteria_apply(link, l_index, this.links,
                                  criteria, negate, function(a,b){return a|b;});
        return crit.reduce(function(a,b){return a&b;}, true);
    }, this).forEach(callback);
}

/*
 * VGraph: Generate HTML representations of a Graph to 
 * visualise and edit (in a form) its contents. 
 *
 * Public methods:
 *  - VGraph(graph, id, callbacks):   constructor
 *  - register_callback(callback):   define a function to be
 *    called each time data in the graph is modified.
 *  - nodehtml(node, edit):   node view/edit HTML
 *  - linkhtml(link, edit):   link view/edit HTML
 *  - formdata(accessors):   retrieve data from the form
 *  - node_fromdata():   create a node from the form data
 *  - link_fromdata():   create a link from the form data
 *  - show(data, type, edit):  show/edit a node/link
 */

var VGraph = function(graph, id, callbacks = []){
    /*
     * Create a VGraph of the specified graph to be shown in
     * the div $(id).
     *
     * Arguments:
     *   - graph:  the Graph
     *   - id:  id of the container div
     *   - callbacks: list of functions to be called when
     *     data in the graph is modified.
     *
     * Note: VGraph xpects to find a div#metadata and
     *   div#toolbox within div#id. 
     */
    this.graph = graph;
    this.id = id;
    this.tbox_id = this.id + " #toolbox";
    this.data_id = this.id + " #metadata";
    this.update_callbacks = callbacks;
    this.show();
}

VGraph.prototype.register_callback = function(callback) {
    /*
     * Register a function to be called when data is updated
     */
    this.update_callbacks.push(callback);
}

VGraph.prototype.nodehtml = function(node, edit=false) {
    /*
     * Generate an HTML representation of a node
     */
    var nodestr = "<table>";
    if(edit) {
        var txt = "Edit node";
        if(node.name == undefined)
            txt = "New node";
        nodestr += "<tr><th colspan='2'>"+txt+":</th></tr>";
    }else{
        nodestr += "<tr><th>Node:</th><th>"+node.name+"</th></tr>";
    }
    if(edit)
        nodestr += this.field("name", node.name, "text", edit);
    nodestr +=
        this.field("description", node.description, "textarea", edit) +
        this.field("weight", node.weight, "text", edit, true) +
        "</table>";
    return nodestr;
}

VGraph.prototype.linkhtml = function(link, edit=false) {
    /*
     * Generate an HTML representation of a link
     */
    var linkstr = "<table>";
    if(edit) {
        var txt = "Edit link";
        if(link.target == undefined)
            txt = "New link";
        linkstr += "<tr><th>"+txt+"</th><th></th></tr>" +
            this.field("source", link.source && link.source.name, "node", true) +
            this.field("target", link.target && link.target.name, "node", true);
    }else{
        linkstr += "<tr><th class='"+TYPE_CLASS[link.type]+"'>Link:</th><th>"+link.source.name+"&mdash;"+link.target.name+"</th></tr>";
    }

    linkstr +=
        this.field("description", link.description, "textarea", edit, false, "Descr.") +
        this.field("flow", link.flow, "linkflow", edit) +
        this.field("type", link.type, "linktype", edit) +
        this.field("pilot", link.pilot, "linkpilot", edit) +
        this.field("tools", link.tools, "hyperlink", edit) +
        this.field("reference", link.reference, "hyperlink", edit, false, "Refs") +
        this.field("links", link.links, "hyperlink", edit) +
        this.field("notes", link.notes, "textarea", edit) +
        "</table>";
    return linkstr;
}

VGraph.prototype.formdata = function(accessors = {}) {
    /*
     * Gather data from the form and return it in an object =ret=.
     * See notes below.
     *
     * Arguments:
     *  - accessors: a structure relating field names (field.name)
     *    with functions that are used to tranform field values.
     *
     * Form fields can encode arrays of values, or arrays of Objects.
     * The former must be named "_FIELD_INDEX", to obtain
     * :    ret.FIELD[INDEX] = value
     * while the latter must be named "_FIELD_INDEX_SUBFIELD", for
     * :    ret.FIELD[INDEX].SUBFIELD = value
     * where FIELD and SUBFIELD are strings, and INDEX can be
     * parsed to a valid Integer. Field arrays are not grown when
     * value is an empty string.
     */
    var ret = {};
    var subfields = [];
    $(this.id).find("input, textarea, select").each(function() {
        var inputType = this.tagName.toUpperCase() === "INPUT" && this.type.toUpperCase();
        if (inputType !== "BUTTON" && inputType !== "SUBMIT") {
            if(inputType == "CHECKBOX" && !this.checked) return;
            if(this.name.startsWith("_"))
                subfields.push(this.name.split("_").splice(1).concat(this.value));
            else {
                var lambda = function(val){return val};
                if(this.name in accessors)
                    lambda = accessors[this.name];
                ret[this.name] = lambda(this.value);
            }
        }
    });

    // unpack subfields
    subfields.forEach(function(sf, i) {
        var field = sf[0],
            index = parseInt(sf[1]),
            value = sf[2];

        if(!ret[field]) // create field if missing
            ret[field] = [];

        if(sf.length == 4) {    // object list: (type, index, field, value)
            var subfield = value,
                value = sf[3];
            if(value == "") // skip empty values
                return;
            if(!ret[field][index])
                ret[field][index] = {};
            ret[field][index][subfield] = value;
        }else{                  // plain list: (type, index, value)
            if(value == "") // skip empty values
                return;
            ret[field][index] = value;
        }
    });
    return ret;
}

VGraph.prototype.node_fromdata = function() {
    /*
     * Construct a new node based on the current formdata.
     */
    return new Node(this.formdata());
}

VGraph.prototype.link_fromdata = function() {
    /*
     * Construct a new link based on the current formdata.
     */
    var link = new Link(this.formdata());
    // Ensure objects as source/target
    link.source = this.graph.nodes[link.source];
    link.target = this.graph.nodes[link.target];
    // Deal with pilot projects
    if(link.pilot)
        link.pilot = link.pilot.reduce(function(a,b) {return parseInt(a) + parseInt(b);});
    return link;
}

VGraph.prototype.show = function(d, type, edit=false) {
    /*
     * Display metadata for node/link =d=, and activate
     * the pertinent tools in the toolbox.
     *
     * Arguments:
     *     - d (object): node/link to display
     *     - type (string): "node" or "link"
     *     - edit (boolean): display or edit
     */
    var self = this;
    $(this.tbox_id+" .item").hide(); // hide all
    if(typeof d === 'undefined' || typeof type === 'undefined' || (!edit && $.isEmptyObject(d))) {
        $(this.data_id).html("Click a node or link...");
        this.activate_tool(".add",  "Add Node",  function(){self.node_new();});
    }else{ 
        if(type == "node") {
            $(this.data_id).html(this.nodehtml(d, edit));
            if(edit) {
                this.activate_tool(".cancel", "Cancel", function(){self.show(d,"node");});
                this.activate_tool(".submit", "Save",   function(){self.node_update(d);});
            }else{
                this.activate_tool(".add",  "Add Node",	function(){self.node_new();});
                this.activate_tool(".edit", "Edit Node",	function(){self.node_edit(d);});
                this.activate_tool(".delete", "Delete Node",function(){self.node_delete(d);});
                this.activate_tool(".link", "Link Node", 	function(){self.link_new(d);});
            }
        }else if(type == "link") {
            $(this.data_id).html(this.linkhtml(d, edit));
            if(edit) {
                this.activate_tool(".cancel", "Cancel", function(){self.show(d,"link");});
                this.activate_tool(".submit", "Save",   function(){self.link_update(d);});
            }else{
                this.activate_tool(".add",  "Add Link",	function(){self.link_new();});
                this.activate_tool(".edit", "Edit Link",	function(){self.link_edit(d);});
                this.activate_tool(".delete", "Delete Link",function(){self.link_delete(d);});
            }
        }else{
            errorHandle("Sorry, cannot show entity of type <"+type+">.");            
        }
    }
    // Adjust box height
    $(this.data_id).height( "auto" );
    var Hdata    = $(this.data_id).outerHeight(),
        Htoolbox = $(this.tbox_id).outerHeight(),
        Hbox     = Hdata + Htoolbox;
    if($(this.tbox_id).css("display") == "none")
        Hbox     = Hdata;
    if(Hbox > height) { // cap to svg height
        Hbox = height;
        $(this.data_id).height( Hbox - Htoolbox );
    }
    $(this.id).animate({
        height: Hbox
    });
}

VGraph.prototype.update = function() {
    /*
     * Execute all callbacks
     */
    this.update_callbacks.forEach(function(fun){return fun();});
}

VGraph.prototype.field = function(name, value, type, edit,
                                  derived=false, title=null, style="") {
    /*
     * Generate an HTML representation of a field, either
     * to display, or to edit (when edit is true).
     *
     * Arguments:
     *   name (string): name of the field
     *   value (various): value of the field
     *   type (string): type of the field, see below
     *   edit (boolean): activates the editing interface
     *   derived (boolean): false if the field is editable
     *   title (string): name of the field to use instead of name ("" for no title)
     *   style (string): css class for to the TD
     *
     * Notes:
     *   Field types. Valid field types are:
     *     - text: plain text field
     *     - node: one of the graph's nodes
     *     - linkflow: flow of a link (see Link)
     *     - linktype: type of link (see Link)
     *     - linkpilot: pilot project(s) to which link applies (see Link)
     *     - hyperlink: list of hyperlinks (see Link)
     *
     */
    var self = this;
    if(edit && derived)
        return "";
    if(!edit && value == "")
        return "";
    if(edit && value == undefined)
        value = "";

    if(title === null) title = capitalize(name);
    var retstr = "<tr>";
    if(title != "")
        retstr += "<td class='"+style+"'>"+title+":</td><td>";
    else
        retstr += "<td colspan='2'>";
    if(edit) {
        // edit
        if(type == "textarea")
            retstr += "<textarea rows='5' cols='20' name='"+name+"'>"+value+"</textarea>";

        else if(type == "node")
            retstr += "<select name='"+name+"'>" +
            this.graph.nodes.map(function(node, i) {
                var selected = "";
                if(node.name == value) selected = "selected";
                return "<option value="+i+" "+selected+">"+node.name+"</option>";
            }) + "</select>";

        else if(type == "linkflow")
            retstr += "<select name='"+name+"'>" +
            FLOW_DESCRIPTION.map(function(flow, i) {
                var selected = "";
                if(i == value) selected = "selected";
                return "<option value="+i+" "+selected+">"+flow+"</option>";
            }) + "</select>";

        else if(type == "linktype")
            retstr += "<select name='"+name+"'>" +
            TYPE_DESCRIPTION.map(function(type, i) {
                var selected = "";
                if(i == value) selected = "selected";
                return "<option value="+i+" "+selected+">"+type+"</option>";
            }) + "</select>";

        else if(type == "linkpilot")
            retstr += PILOTS.map(function(pilot, i) {
                var checked = "";
                var fname = ["",name,i].join("_");
                if(pilot & value) checked = "checked";
                return "<label><input type='checkbox' name='"+fname+"' value="+pilot+" "+checked+" />"+PILOT_DESCRIPTION[i]+"</label>";
            }).join("<br />");
        
        else if(type == "hyperlink") { // value is [{text, link}, ...]
            retstr += "</td></tr><tr><td colspan='2'><table>";
            if(value == "")
                value = [];
            retstr += value.concat({}).map(function(ref, i) {
                return self.field(["",name,i,"text"].join("_"), ref.text, "text", true, false, (i+1)+".Text", "subfield") +
                       self.field(["",name,i,"link"].join("_"), ref.link, "text", true, false, (i+1)+".Link", "subfield");
            }).join("") + "</table>";
        }

        else // text
            retstr += "<input type='text' size='20' name='"+name+"' value='"+value+"' />";

    } else {
        // display
        if(type == "hyperlink" && value)
            retstr += value.map(function(ref, i) {
                return "<a href='http://"+ref.link+"'>"+ref.text+"</a>"
            }).join("<br/>");

        else if(type == "linkflow")
            retstr += FLOW_DESCRIPTION[value];

        else if(type == "linktype")
            retstr += TYPE_DESCRIPTION[value];

        else if(type == "linkpilot")
            retstr += PILOTS.map(function(pilot, i) {
                if(pilot & value) return PILOT_DESCRIPTION[i];
            }).clean(undefined).join(",");
        
        else // text & others
            retstr += value;
    }
    retstr += "</td>";
    return retstr;
}

/* VGraph callbacks */
VGraph.prototype.activate_tool = function(sel, title, callback) {
    /*
     * Utility function to activate tools
     * in the toolbox and assign the right
     * callback.
     *
     * Arguments:
     *    - sel: a valid selector for a tool
     *    - title: value of the "title" propery to assign to the tool
     *    - callback: the callback to assign to the tool
     */
    sel = this.tbox_id+" "+sel;
    $(sel).prop("title", title);
    $(sel+" a").off("click").click(callback);
    $(sel).show();
}
VGraph.prototype.node_new = function()  {return this.show({}, "node", true);}
VGraph.prototype.node_edit = function(node) {return this.show(node, "node", true);}
VGraph.prototype.node_update = function(node) {
    var retvalue = 0,
        node2 = this.node_fromdata(),
        shownode = null;
    if(node.name) {
        message(LOG_DEBUG, "Updating node: ", node, "with", node2);
        if(node.update(node2) < 0)
            retvalue = errorHandle("Sorry, could not update node.");
        shownode = node;
    }else{
        message(LOG_DEBUG, "Adding node: ", node2);
        if(this.graph.addnode(node2) < 0)
            retvalue = errorHandle("Sorry, could not add the node.");
        shownode = node2;
    }
    this.update();
    if(retvalue == 0)
        this.show(shownode, "node");
    else
        this.show();
    return retvalue;
}
VGraph.prototype.node_delete = function(node) {
    var retvalue = 0;
    message(LOG_DEBUG, "Deleting node: ", node);
    // confirm?
    if(this.graph.delnode(node) < 0)
        retvalue = errorHandle("Sorry, could not delete the node.");
    this.update();
    this.show();
    return retvalue;
}

VGraph.prototype.link_new = function(node)  {
    var init = {};
    if(node)
        init.source = node;
    return this.show(init, "link", true);
}
VGraph.prototype.link_edit = function(link) {return this.show(link, "link", true);}
VGraph.prototype.link_update = function(link) {
    var retvalue = 0,
        link2 = this.link_fromdata(),
        showlink = null;
    if(link.target) {
        message(LOG_DEBUG, "Updating link: ", link, "with", link2);
        if(link.update(link2) < 0)
            retvalue = errorHandle("Sorry, could not update link.");
        showlink = link;
    }else{
        message(LOG_DEBUG, "Adding link: ", link2);
        if(this.graph.addlink(link2) < 0)
            retvalue = errorHandle("Sorry, could not add the link.");
        showlink = link2;
    }
    this.update();
    if(retvalue == 0)
        this.show(showlink, "link");
    else
        this.show();
    return retvalue;
}
VGraph.prototype.link_delete = function(link) {
    var retvalue = 0;
    message(LOG_DEBUG, "Deleting link: ", link);
    if(this.graph.dellink(link) < 0)
        retvalue = errorHandle("Sorry, could not delete the link.");
    this.update();
    this.show();
    return retvalue;
}

/* Filtering */

function filter_callback(graph, criteria) {
    /*
     * Callback for filtering: hides links matching criteria
     */
    graph.links.forEach(function(link){link.hidden = true;});
    graph.filter_links(criteria, function(link) {link.hidden = false;});
}

function negate(func) {
    /*
     * Negate a function
     */
    return function(x) {
        return !func(x);
    };
}

function make_filters(id, layout) {
    /*
     * Construct filters GUI in div#id to act on GraphLayout layout.
     *
     */
    $(id).html(
        "" +
            PILOTS.map(function(pilot,i) {
                return "<label><input type='checkbox' alt='pilot' value='"+pilot+"' checked />"+PILOT_DESCRIPTION[i]+"</label>";
            }).join("<br/>") +
            "<br/>"+
            TYPE_DESCRIPTION.map(function(type, i) {
                return "<label><input type='checkbox' alt='type' value='"+i+"' checked />"+TYPE_DESCRIPTION[i]+"</label>";
            }).join("<br/>") +
            "<br/>"+
            "<input type='button' value='Reset' id='reset' />"
    );
    var callbacks = {
        "pilot": function(v) {return function(link){return (link.pilot & parseInt(v)) > 0;};},
        "type":  function(v) {return function(link){return link.type == v;};},
    };
    
    function reset() {
        /* Reset all filters to checked */
        $(id).find("input:checkbox").each(function() {
            if(this.type.toUpperCase() == "CHECKBOX")
                this.checked = true;
        });
    }
    function update() {
        /* Collect filter criteria and apply */
        var criteria = {};
        $(id).find("input:checkbox").each(function() {
            if(this.type.toUpperCase() == "CHECKBOX") {
                var f = this.alt, v = this.value;
                if(!criteria[f]) criteria[f] = [];
                if(this.checked)
                    criteria[f].push(callbacks[f](v));
            }
        });
        // flatten criteria
        filter_callback(layout.graph,
                        Object.keys(criteria).map(function (key) {return criteria[key]}));
        layout.update();
    }

    $(id + " #reset").click(reset);
    $(id).find("input").click(update);
}

/*
 * GraphLayout: A D3.js-based visualisation of a graph.
 * For more information see documentation of the D3 force
 * layout. Data for the graph is loaded from an input file.
 * 
 * Public methods:
 *  - Graph(id, filein, type):   constructor
 *  - init():  initialise the layout
 *  - update():  update visualisation upon data change
 *  - refresh():  re-optimise node locations
 *  - release():  release all nodes that are fixed
 *  - on(event, callback):  register a callback for an event.
 *  - set_locations(locations, scale): set the positions of nodes.
 *  - get_locations(): get the positions of nodes.
 */
var GraphLayout = function(id, filein, type="json") {
    /*
     * Construct a datagraph in the specified div ($("#id")),
     * and populate it with data from the =filein= input file
     * of type =type=. Supported types are "json" and "csv".
     *
     * - JSON:
     *   - "nodes" is an array of objects, each containing the 
     *   following keys: name, description (see Node).
     *   - "links" is an array of objects, each containing the
     *   following keys: source, target, flow, type, notes, 
     *   description, reference, tools, links (see Link).
     * - CSV:
     *   each line is a link with fields: source, target, flow,
     *   type, notes, description, reference, tools, links (see
     *   Link). Due to the simplicity of the csv format, there
     *   are some differences with respect to the JSON format.
     *   The reference, links and tools columns can contain a
     *   semicolon-separated list of strings. In the case of
     *   reference, all those strings are used as the "text"
     *   field of as many HyperLink instances; the "link"
     *   field of these is taken from the first entries in
     *   the links column. The remaining entries in the link
     *   column, as well as all entries in the tools column
     *   act both as "text" and "link".
     */
    this.svg = d3.select(id).append("svg")
        .attr({
            width: 900,
            height: height
        });

    this.link_dist = Math.min(width,height)/4.0;
    this.link_spread = 0.3; // radians
    this.graph = new Graph();

    var self = this;
    if(type=="csv") 
        d3.csv(filein, function(link){self.graph.addlink(link);},
               function(error, data) {
                   if(error)
                       errorHandle(error);
                   else
                       self.init();
               });
    else if(type=="json")
        d3.json(filein,
                function(error, data) {
                    if(error)
                        errorHandle(error);
                    else {
                        data.nodes.forEach(function(node){self.graph.addnode(node);});
                        data.links.forEach(function(link){self.graph.addlink(link);});
                        self.init();
                    }
                });

    this.make_markers();
    this.make_legend();
    this.tools = [];
    this.modified = false;
    //this.register_tool(function() {submit_json(self.graph.to_json());}, "images/cloudup.svg", "Save changes to server");
    this.register_tool(function() {download_json(self.graph.to_json());}, "images/clouddown.svg", "Download network as JSON");
    this.register_tool(function() {circle(self);}, "images/circle.svg", "Arrange nodes in a circle");
    this.register_tool(function() {hexagon(self);}, "images/hexagon.svg", "Arrange nodes in a hexagon");
    this.register_tool(function() {self.release();}, "images/spring.svg", "Release all fixed nodes");
    this.register_tool(function() {download_json(JSON.stringify(self.get_locations()), "layout.json");}, "images/laydown.svg", "Download node layout");
    this.register_tool(function() {upload_json(function(layout){self.set_locations(layout, 1, false);});}, "images/layup.svg", "Upload node layout");
    
    this.node_callback = null;
    this.link_callback = null;
    return this;
}

GraphLayout.prototype.init = function() {
    /*
     * Build the UI of the datagraph.
     */
    // Create containers (links below nodes)
    this.svg.append("g").attr("id","link-container");
    this.svg.append("g").attr("id","node-container");

    /* Generate the MIN Toolbox, according to
     * configuration (see TOOL* variables).
     */
    this.svg.append("g").attr("class","toolbox");
    this.update_toolbox();
    
    // Initialise node positions to circle
    this.graph.nodes.forEach(function(node, i) {
        var th = Math.random() * 2 * PI;
        node.x = (1+Math.sin(th))*width/2;
        node.y = (1+Math.cos(th))*width/2;
    });

    var self = this;
    // Create layout
    this.force = d3.layout.force()
        .linkDistance(this.link_dist)
        .linkStrength(.02)
        .charge(-120)
        .gravity(.015)
        .size([width, height])
        .on("tick", function() {
            /*
             * Main timestep function.
             * Handle one timestep of the force simulation.
             * To update positions in the layout, call:
             *    force.alpha(f) with f>0.0
             */
            var node = self.svg.selectAll('.node');
            node.attr({
                transform: function(d) {
                    if(d.conf && this.getAttribute("cx")) {
                        d.x = parseFloat(this.getAttribute("cx"));
                        d.y = parseFloat(this.getAttribute("cy"));
                    }
                    return "translate(" + d.x + "," + d.y + ")"; },
                class: function(d) {
                    var cl = "node";
                    if(d.fixed) cl += " fixed";
                    return cl;
                }
            });
            
            var link = self.svg.selectAll('.link');
            link.attr("d", function(d) {
                // get corrected link info
                var clink = self.correctLink(d, self.link_spread);
                // use line if single link or flow link
                // otherwise, use arc.
                if(d.weight == 1 || d.flow == FLOW_CONNECT)
                    return self.pathline(clink);
                else
                    return self.patharc(clink);
            }).style("opacity", function(d) {
                var clink = self.correctLink(d, self.link_spread),
                    invmindist = 0.03; // 3/link_dist
                return Math.min(1.0, invmindist*clink.dr);
                /* Some useful debugging:
                   if(d.tools=="cgDNA")
                   $("#debug").text(
                   clink.x0.toFixed(1)+","+clink.y0.toFixed(1)+","+
                   clink.x1.toFixed(1)+","+clink.y1.toFixed(1)+","+
                   clink.dx.toFixed(1)+","+clink.dy.toFixed(1)+","+
                   clink.dr.toFixed(1)+","+(invmindist*clink.dr).toFixed(1));
                */
            });
        });
    this.force
        .nodes(this.graph.nodes)
        .links(this.graph.links);
    this.update();
};

GraphLayout.prototype.update = function() {
    /*
     * Update the datagraph visualisation.
     * Call this whenever the data changes (including at init time)
     */
    var self = this;

    // Resize Legend
    this.resize_legend();

    // Add/update links
    var link = this.svg.select("#link-container").selectAll('.linkg')
        .data(this.graph.links);

    link.exit().remove();

    var linkEnter = link.enter().append('g')
        .attr("class", "linkg")
        .on("click", function(d) {
            /*
             * Callback for clicking links
             */
            message(LOG_DEBUG, d);
            if(self.link_callback)
                self.link_callback(d);
        });
    
    // Filtering
    link.attr("class", function(d) {
        if(d.hidden) return "linkg hidden";
        else return "linkg";
    });
    
    linkEnter.append("path") // Add invisible path
        .attr('class', 'link hid');
    linkEnter.append("path") // Add visible path
        .attr('class', 'link viz');
    
    // Use selection.select to propagate data to children
    link.select('.hid');
    link.select('.viz')
        .attr({
            class: 		function(d) {
                return "link viz " + TYPE_CLASS[d.type];
            },
            'marker-end': 	function(d) {
                return "url(#rarrow"+d.type+")";
            },
            'marker-start':	function(d) {
                if(d.flow == FLOW_CONNECT)
                    return "url(#larrow"+d.type+")";
            }});

    /* Ideally this is done with "positional markers";
     * tick() updates their position given the direction.
     * See https://www.w3.org/TR/svg-markers/, and stay
     * tuned for when they work.
     * 
     *linkEnter.append('marker')
     *        .attr({
     *         'href': 'url(#rarrow)',
     *         'position': '90%'});
     */

    // Add/update nodes
    var node = this.svg.select("#node-container").selectAll('.node')
        .data(this.graph.nodes);

    node.exit().remove();

    var nodeEnter = node.enter().append('g')
        .attr({
            class: "node"
        })
        .on("click", function(d) {
            /*
             * Callback for clicking nodes
             */
            message(LOG_DEBUG, d);
            if (d3.event.defaultPrevented) return; // ignore drag
            if (d3.event.shiftKey) {
                d.fixed = !d.fixed;
            }
            self.refresh();
            if(self.node_callback)
                self.node_callback(d);
        })
        .call(this.force.drag);

    nodeEnter.append("ellipse") // Add ellipse
        .attr('class', 'nodecirc');
    nodeEnter.append("text")    // Add text
        .attr({
            class: 'nodetxt',
            dy: 5,
            'text-anchor': "middle",
        });
    
    // Use selection.select to propagate data to children
    node.select('.nodetxt')
        .text(function(d) { return d.name; });
    
    // Use selection.select to propagate data to children
    node.select('.nodecirc')
        .attr({
            rx: function(d) {
                d.rx = Math.max(30, d3.select(this.parentNode).select('.nodetxt').node().getBBox().width/1.8);
                return d.rx;
            },
            ry: function(d) {
                d.ry = 30;
                return d.ry;
            }});
    
    this.force.start();
}

GraphLayout.prototype.refresh = function() {
    /* Let the layout adapt to changes */
    this.force.alpha(1.0);
}

GraphLayout.prototype.release = function() {
    /* Unfix all nodes */
    this.graph.nodes.forEach(function(d) {d.fixed=false;});
    this.refresh();
}

/* Callback functions */
GraphLayout.prototype.on = function(event, callback) {
    /*
     * Register an event callback. Supported events are:
     *  - node_click:  clicking a node
     *  - link_click:  clicking a link
     */
    if(event == "node_click")
        this.node_callback = callback;
    else if(event == "link_click")
        this.link_callback = callback;
    else
        message(LOG_ERROR, "Event "+event+" not supported");
}

/* Other utility functions */
GraphLayout.prototype.correctRadius = function(node, arrow=false) {
    /*
     * Correct node radius according to node display,
     * and whether the link ends with an arrow.
     */
    var ret = 1;
    if(arrow)
        ret += 2;
    if(!node.fixed)
        ret += 1;
    return ret;
}

GraphLayout.prototype.correctLink = function(link, dth) {
    /* 
     * Correct link endpoints according to node radii.
     * dth is the minimum angular distance between links (in radians).
     * Expects nodes to be ellipses.
     */
    var rdx = link.target.x - link.source.x,
        rdy = link.target.y - link.source.y,
        th  = Math.atan2(rdy, rdx),
        dth = (link.flow == FLOW_CONNECT ? 0 : link.weight > 1 ? dth:0),
        sdr = this.correctRadius(link.source, link.flow == FLOW_CONNECT),
        tdr = this.correctRadius(link.target, true),
        s_rx = link.source.rx + sdr,
        s_ry = link.source.ry + sdr,
        t_rx = link.target.rx + tdr,
        t_ry = link.target.ry + tdr,
        sth = th-dth/2,
        tth = th+dth/2,
        sct = Math.cos(sth),
        sst = Math.sin(sth),
        tct = Math.cos(tth),
        tst = Math.sin(tth),
        sr = s_rx*s_ry/Math.sqrt(Math.pow(s_ry*sct,2) + Math.pow(s_rx*sst,2)),
        tr = t_rx*t_ry/Math.sqrt(Math.pow(t_ry*tct,2) + Math.pow(t_rx*tst,2)),
        dsx = sr * sct,
        dsy = sr * sst,
        dtx = tr * tct,
        dty = tr * tst,
        dx  = rdx - dsx - dtx,
        dy  = rdy - dsy - dty;

    return {
        x0 : link.source.x + dsx,
        y0 : link.source.y + dsy,
        x1 : link.target.x - dtx,
        y1 : link.target.y - dty,
        dx : dx,
        dy : dy,
        dr : Math.sqrt(dx * dx + dy * dy)*1.4
    };
}

GraphLayout.prototype.pathline = function(link) {
    /*
     * A line from (x0,y0) to (x1,y1).
     */
    return "M" + link.x0 + "," + link.y0 +
        "L" + link.x1 + "," + link.y1;
}

GraphLayout.prototype.patharc = function(link) {
    /*
     * A circular arc of radius dr from (x0,y0) to (x1,y1).
     */
    return "M" + link.x0 + "," + link.y0 +
        "A" + link.dr + "," + link.dr + " 0 0,1 " +
        link.x1 + "," + link.y1;
}

/* Location functions */
GraphLayout.prototype.set_locations = function(locations, scale, centered=true) {
    /*
     * Set the location of nodes in the layout by using
     * the information specified in =locations=, scaled
     * by =scale=.
     *
     * Arguments:
     *    - locations: a structure relating node names,
     *      as strings, to [x, y] pairs.
     *    - scale: a scalar used to multiply coordinates.
     *    - centered: boolean defining the coordinate system
     *      for locations:
     *      true (default): [0,0] is the bottom center of the
     *      SVG, with y increasing upwards;
     *      false: [0,0] is the top-left corner of the SVG,
     *      with y increasing downwards.
     */
    var node = this.svg.selectAll('.node');
    node.attr({
        cx: function(d){d.fixed=true; d.conf=true; return d.x;},
        cy: function(d){return d.y;}
    });
    var x0 = width/2,
        y0 = 0.9*height,
        yd = -1;
    if(!centered) {
        x0 = 0,
        y0 = 0,
        yd = +1;
    }
    node.transition().duration(transitionDuration).attr({
        cx: function(d) {
            var loc = locations[d.name];
            if(!loc) {
                message(LOG_WARN, d.name+" not found in locations!");
                return x0;
            }
            return x0 + scale*loc[0];
        },
        cy: function(d) {
            var loc = locations[d.name];
            if(!loc) {
                message(LOG_WARN, d.name+" not found in locations!");
                return height/2;
            }
            return y0 + yd * scale*loc[1];
        }})
        .each("end", function(d) {d.px=d.x; d.py=d.y; d.conf=false;});
    this.refresh();
}

GraphLayout.prototype.get_locations = function() {
    /*
     * Get the location of nodes in the layout.
     *
     * Returns a structure relating node names,
     * as strings, to [x, y] pairs, where [0, 0] is
     * the top-left corner of the SVG.
     *
     * Usage:
     *  g = GraphLayout(...);
     *  loc = g.get_locations();
     *  g.set_locations(loc, 1, false);
     *
     */
    var locations = {};
    var node = this.svg.selectAll('.node');
    node.each(function(d,i) {
        locations[d.name] = [d.x, d.y];
    });
    return locations;
}

/* Other UI functions */
GraphLayout.prototype.register_tool = function(callback, icon, alt, position=10000, update=true) {
    /*
     * Register a tool in the toolbox, providing an icon
     * to represent the tool and callback to call on click.
     */
    var newtool = {
        callback: callback,
        icon: icon,
        alt: alt
    };
    if(position >= this.tools.length) 
        this.tools.push(newtool);
    else
        this.tools.splice(position, 0, newtool);
    if(update)
        this.update_toolbox();
}

GraphLayout.prototype.update_toolbox = function() {
    /*
     * Update the toolbox
     *
     */
    var ntool = this.tools.length;
    var tools = this.svg.select(".toolbox")
        .attr("transform","translate("+(width-TOOLmh-TOOL_SIZE*ntool)+","+TOOLmv+")")
        .selectAll(".tool").data(this.tools);
    
    var tool = tools.enter().append("g")
        .attr({
            class: "tool",
            transform: function(d,i){
                return "translate("+i*TOOL_SIZE+",0)";}
        })
        .on("click", function (d, i) {
            d.callback.call();
        });
    tool.append("rect")
        .attr({
            width: TOOL_SIZE,
            height: TOOL_SIZE
        })
    tool.append("image")
        .attr({
            "xlink:href": function(d,i){return d.icon;},
            width: TOOL_SIZE,
            height: TOOL_SIZE,
        });
    tool.append("title")
        .text(function(d,i){return d.alt;});
}

GraphLayout.prototype.make_legend = function() {
    /*
     * Generate the legend according to configuration
     * (see LEGEND_* variables).
     */
    var legend = this.svg.append("g").attr("class","legend");
    var entries = legend.selectAll(".entry").data(TYPE_CLASS);
    var Eenter = entries.enter().append("g")
        .attr({
            transform: function(d,i){
                return "translate("+LEGEND_POSx+","+(LEGEND_POSy+LEGEND_HIG*(i+1))+")";
            },
            class: "entry"
        });
    Eenter.append("line")
        .attr({
            y1:-6,
            x2:LEGEND_WID,
            y2:-6,
            class: function(d){return d;}
        });
    Eenter.append("text")
        .text(function(d,i){return TYPE_DESCRIPTION[i];})
        .attr({
            x: LEGEND_WID+LEGEND_MRG
        });
    legend.append("rect")
        .attr({
            class: "legendbox",
            x: LEGEND_POSx-5,
            y: LEGEND_POSy,
            rx: 10,
            ry: 10,
            width: LEGEND_WID+LEGEND_MRG+10,
            height: LEGEND_HIG*NTYPES+10
        });
    this.resize_legend();
}

GraphLayout.prototype.resize_legend = function() {
    /*
     * Resize the legend to match contained text.
     */
    var legend = d3.select(".legend");
    var widths = [];
    legend.selectAll("text").each(function(){widths.push(this.getComputedTextLength());});
    d3.select(".legendbox")
        .attr({
            width: Math.max.apply(null, widths)+LEGEND_WID+LEGEND_MRG+10,
        });
}

GraphLayout.prototype.make_markers = function() {
    /*
     * Create required markers for arrows
     */
    var defs = this.svg.append("defs");
    var mkw = 3.0;

    for(t=0; t<NTYPES; t++) {
        defs.append("marker")
           .attr({
               id: "rarrow"+t,
               viewBox: "0 -5 10 10",
               refX: 8,
               refY: 0,
               markerWidth: mkw,
               markerHeight: mkw,
               orient: "auto"
           })
           .append("path")
           .attr({
                d: "M0,-5L10,0L0,5",
               class: "arrowHead "+TYPE_CLASS[t]});

        defs.append("marker")
           .attr({
               id: "larrow"+t,
               viewBox: "0 -5 10 10",
               refX: 2,
               refY: 0,
               markerWidth: mkw,
               markerHeight: mkw,
               orient: "auto"
           })
           .append("path")
           .attr({
                d: "M10,-5L0,0L10,5",
               class: "arrowHead "+TYPE_CLASS[t]});
    }
}


function pentagon(layout) {
    var a=0.32,
        b=0.53,
        c=0.62,
        d=0.9,
        scale=400;
    var locations = {
        "MNase-seq": 	 [0,  d],
        "RNA-seq": 	 [-a, c*0.7],
        "Histone marks": [0,  c*0.75],
        "ChIP-seq":	 [b,  c],
        "Hi-C":		 [a,  a], 
        "Physical models (bp)": 	[-b, c],
        "Chromatin structure":	 	[a,  0],
        "Physical models (kbp)":	[-a, 0],
        "Atomistic MD":	 		[-a, d],
        "FISH":		 [-a*0.6, c*0.4]};
    layout.set_locations(locations, scale);
}

function hexagon(layout) {
    var a=0.5,
        b=1.0,
        c=1.15,
        d=1.4*c,
        scale=220;
    var locations = {
	"MNase-seq":	 [a,  d],
	"RNA-seq":	 [-a*1.2, c*0.75],
	"Histone marks": [0,  c*0.75],
	"ChIP-seq":	 [b,  c],
	"Hi-C":		 [a,  a*1.1], 
	"Physical models (bp)": [-b, c],
	"Chromatin structure":  [a,  0],
	"Physical models (kbp)":[-a, 0],
	"Atomistic MD":         [-a, d],
	"FISH":		 [-a*0.65, c*0.45]};
    layout.set_locations(locations, scale);
}

function circle(layout, random = false) {
    var scale=185,
        locations = {},
        th;
    layout.graph.nodes.forEach(function(d,i,A) {
        if(random)
            th = Math.random() * 2 * PI;
        else
            th = i/A.length * 2 * PI;
        locations[d.name] = [
            Math.cos(th),
            Math.sin(th)+1];
    });
    layout.set_locations(locations, scale);
}

/* Submitting */
function submit_json(graph_json) {
    $.ajax({
        url: "mugin_submit.php",
        type: 'POST',
        contentType:'application/json',
        data: graph_json,
        dataType:'json',
        success: function(data){
            message(LOG_INFO, "Data saved correctly.");
        },
        error: function(xhr, ajaxOptions, thrownError) {
            message(LOG_ERROR, "Error saving data! ("+xhr.status+")");
        }
    });
}

function download_json(json_object, filename="mugin.json") {
    /*
     * Calling this function triggers the download of a json file
     * with the specified name, containing json_object.
     *
     */
    var data = "text/json;charset=utf-8," + encodeURIComponent(json_object);
    $('body').append('<a id="json_link" href="data:' + data + '" download="'+filename+'">download JSON</a>')
    $('#json_link')[0].click();
    $('#json_link')[0].remove();
}

function upload_json(callback, extension="json") {
    /*
     * Calling this function triggers a file-selection mask to
     * upload a file with the specified extension using
     * FileReader, and running the specified callback with the
     * uploaded object as argument.
     *
     */
    d3.select('body')
        .append("input")
        .attr("type", "file")
        .attr("accept", "."+extension)
        .attr("id", "json_upload")
        .style("display", "none")
        .on("change", function() {
            var file = d3.event.target.files[0];
            if (file) {
                var reader = new FileReader();
                reader.onloadend = function(evt) {
                    // hardcode json parsing in upload
                    var obj = JSON.parse(evt.target.result);
                    console.log("UPJ",obj);
                    callback(obj);
                    $('#json_upload')[0].remove();
                };
                reader.readAsText(file);
            }
        });    
    $('#json_upload')[0].click();
}
