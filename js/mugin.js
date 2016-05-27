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
 * TODO: 
 *  1. directional links DONE v0.2
 *  2. double links      DONE v0.2
 *  3. improved metadata DONE v0.3
 *  4a. JSON input/output
 *  4. editable metadata
 *  5. graph bidimensional sorting
 *  6. multiple entries per link
 *
 */

var nodeinfo = {
    "MNase":		 "Nucleosome positioning",
    "RNA-seq":		 "Gene expression",
    "Histone marks":	 "ChIP-seq data on epigenetic histone modifications",
    "ChIP-seq":		 "Transcription factor binding",
    "Hi-C":		 "Chromatin contact matrices",
    "Models (bp)":	 "Physical models of chromatin at the base-pair resolution",
    "3D chromatin":	 "Predicted structure of chromatin",
    "Models (kbp)":	 "Physical models of chromatin at the kilo-base-pair resolution",
    "DNA MD":		 "Molecular Dynamics simulations of DNA and protein-DNA complexes",
    "FISH":		 "Microscopy imaging data using fluorescent probes"
};


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

var NFLOWS = 2,
    FLOW_CONNECT = 0,
    FLOW_INFORM  = 1,
    FLOW_DESCRIPTION = ["Connect", "Inform"];

/* Configuration */
var width = 600,
    height = 500,
    transitionDuration = 1000, // ms
    link_dist = Math.min(width,height)/4.0,
    link_spread = 0.2; // radians

/* Globals */
var svg, graph = {}, force;


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

function capitalize(string) {
    return string.substr(0, 1).toUpperCase() + string.substr(1);
}


/* Other utility functions */
function addnode(node) {
    /* XXX move to the graph prototype.
     * Add a node to the graph 
     */

    if(graph.nodelist.indexOf(node.name) >= 0)
        return graph.nodelist.indexOf(node.name);

    var th = Math.random() * 2 * PI;

    var ret = graph.nodelist.push(node.name);
    node.x= (1+Math.sin(th))*width/2;
    node.y= (1+Math.cos(th))*width/2;
    node.rx= Math.max(30, node.name.length*4);
    node.ry= 30;
    graph.nodes.push(node);
    return ret-1;
}

function correctLink(d, dth) {
    /* 
     * Correct link positions according to node radii.
     * dth is the minimum angular distance between links (in radians).
     *
     * Expects nodes to be ellipses.
     */
    var rdx = d.target.x - d.source.x,
        rdy = d.target.y - d.source.y,
        th  = Math.atan2(rdy, rdx),
        dsx = d.source.rx * Math.cos(th-dth/2),
        dsy = d.source.ry * Math.sin(th-dth/2),
        dtx = d.target.rx * Math.cos(th+dth/2),
        dty = d.target.ry * Math.sin(th+dth/2),
        dx  = rdx - dsx - dtx,
        dy  = rdy - dsy - dty;
    
    return {
        x0 : d.source.x + dsx,
        y0 : d.source.y + dsy,
        x1 : d.target.x - dtx,
        y1 : d.target.y - dty,
        dx : dx,
        dy : dy,
        dr : Math.sqrt(dx * dx + dy * dy)*1.4
    };
}

function pathline(link) {
    // A line from (x0,y0) to (x1,y1).
    return "M" + link.x0 + "," + link.y0 +
        "L" + link.x1 + "," + link.y1;
}

function patharc(link) {
    // A circular arc of radius dr from (x0,y0) to (x1,y1).
    return "M" + link.x0 + "," + link.y0 +
        "A" + link.dr + "," + link.dr + " 0 0,1 " +
        link.x1 + "," + link.y1;
}

function textifynode(d) {
    // Return text description of node
    return `
        <table>
        <tr><th colspan="2">Node: ` + d.name + `</th></tr>
        <tr><td colspan="2">` + d.description + `</td></tr>
        <tr><td>Weight:</td><td>` + d.weight + `</td></tr>
        </table>`;
}

function textifylink(d) {
    // Return text description of link
    var linkstr = `
        <table>
        <tr><th colspan='2' class='`+TYPE_CLASS[d.type]+`'>Link: ` + d.source.name+"&mdash;"+d.target.name + `</th></tr>
        <tr><td>Description:</td><td>` + d.description + `</td></tr>
        <tr><td>Flow:</td><td>` + FLOW_DESCRIPTION[d.flow] + `</td></tr>
        <tr><td>Type:</td><td>` + TYPE_DESCRIPTION[d.type] + `</td></tr>
        `;
    if(d.reference != "" && d.reference != "Missing") {
        var references = d.reference.split(";");
        var links = d.links.split(";");
        var refstr = references.map( function(s,i){
            return "<a href='http://"+links[i]+"'>"+s+"</a>";
        }).join("<br/>")
        linkstr += "<tr><td>Reference:</td><td>" + refstr + "</td></tr>";
    }
    if(d.tools != "")
        linkstr += "<tr><td>Tools:</td><td>" + d.tools + "</td></tr>";
    if(d.notes != "")
        linkstr += "<tr><td>Notes:</td><td>" + d.notes + "</td></tr>";
    linkstr += "</table>";
    return linkstr;
}

function metadata(d, type) {
    $(".item").hide();
    if(type == "node") {
        $("#metadata").html(textifynode(d));
        $(".add").show();
        $(".edit").show();
        $(".delete").show();
        $(".add").prop("title","Add Node");
        $(".edit").prop("title","Edit Node");
        $(".delete").prop("title","Delete Node");
        $(".link").show();
    }else if(type == "link") {
        $("#metadata").html(textifylink(d));
        $(".add").show();
        $(".edit").show();
        $(".delete").show();
        $(".add").prop("title","Add Link");
        $(".edit").prop("title","Edit Link");
        $(".delete").prop("title","Delete Link");
    }
    // Adjust box height
    $("#metadata_box").height(
        $("#metadata").outerHeight() + $("#metadata_toolbox").outerHeight());
}

function make_toolbox() {
    var TOOL_SIZE = 40,
        TOOLmv = 10,
        TOOLmh = 10;
    var NTOOL = 3,
        TOOL_FUN = [circle, hexagon, release],
        TOOL_ICON = ["images/circle.svg", "images/hexagon.svg", "images/release.svg"];
    
    var toolbox = svg.append("g").attr("class","toolbox")
        .attr("transform","translate("+(width-TOOLmh-TOOL_SIZE*NTOOL)+","+TOOLmv+")")
        .selectAll(".tool").data(TOOL_FUN);
    var tool = toolbox.enter().append("g")
        .attr({
            class: "tool",
            transform: function(d,i){
                return "translate("+i*TOOL_SIZE+",0)";}
        })
        .on("click", function (d, i) {
            TOOL_FUN[i].call();
        });
    tool.append("rect")
        .attr({
            width: TOOL_SIZE,
            height: TOOL_SIZE
        })
    tool.append("image")
        .attr({
            "xlink:href": function(d,i){return TOOL_ICON[i];},
            width: TOOL_SIZE,
            height: TOOL_SIZE,
        });
}

function make_legend() {
    var L_WID = 20,
        L_MRG = 10,
        L_HIG = 20,
        L_POSx= 15,
        L_POSy= 10;
    
    var legend = svg.append("g").attr("class","legend");
    var entries = legend.selectAll(".entry").data(TYPE_CLASS);
    var Eenter = entries.enter().append("g")
        .attr({
            transform: function(d,i){
                return "translate("+L_POSx+","+(L_POSy+L_HIG*(i+1))+")";
            },
            class: "entry"
        });
    Eenter.append("line")
        .attr({
            y1:-6,
            x2:L_WID,
            y2:-6,
            class: function(d){return d;}
        });
    Eenter.append("text")
        .text(function(d,i){return TYPE_DESCRIPTION[i];})
        .attr({
            x: L_WID+L_MRG
        });
    var widths = [];
    Eenter.selectAll("text").each(function(){widths.push(this.getComputedTextLength());});
    legend.append("rect")
        .attr({
            class: "legendbox",
            x: L_POSx-5,
            y: L_POSy,
            rx: 10,
            ry: 10,
            width: Math.max.apply(null, widths)+L_WID+L_MRG+10,
            height: L_HIG*NTYPES+10
        });
}

function make_markers() {
    // Create required markers for arrows
    var defs = svg.append("defs");
    var mkw = 3.0;

    for(t=0; t<NTYPES; t++) {
        defs.append("marker")
	.attr({
	    "id":"rarrow"+t,
	    "viewBox":"0 -5 10 10",
	    "refX":8,
	    "refY":0,
	    "markerWidth":mkw,
	    "markerHeight":mkw,
	    "orient":"auto"
	})
	.append("path")
	.attr("d", "M0,-5L10,0L0,5")
	.attr("class","arrowHead "+TYPE_CLASS[t]);
    
        defs.append("marker")
	.attr({
	    "id":"larrow"+t,
	    "viewBox":"0 -5 10 10",
	    "refX":2,
	    "refY":0,
	    "markerWidth":mkw,
	    "markerHeight":mkw,
	    "orient":"auto"
	})
	.append("path")
	.attr("d", "M10,-5L0,0L10,5")
	.attr("class","arrowHead "+TYPE_CLASS[t]);
    }
}

/* Main Datagraph structure */
// XXX Use the function.call(instance) pattern
//     to wrap all this into an object with an
//     assigned id, tsv; then the _this pattern
//     can be used for callbacks.
function datagraph(id, csv) {
    svg = d3.select(id).append("svg")
        .attr({
            width: 900,
            height: height
        });

    make_markers();
    make_legend();
    make_toolbox();
    
    graph.nodelist = []; // temporary structure to accumulate nodes
    graph.linklist = []; // temporary structure to count links
    graph.nodes = [];
    graph.links = [];
        
    d3.csv(
        csv,
        function(d) {
            // Add nodes
            var src = addnode({name: d.data1, description: nodeinfo[d.data1]}),
                trg = addnode({name: d.data2, description: nodeinfo[d.data2]});
            
            // Check if link exists
            var linkid = Math.min(src,trg)*1e10+Math.max(src,trg),
                linkis = graph.linklist.findAll(linkid),
                weight = 1;
            graph.linklist.push(linkid);
            if(linkis.length > 0) {
                weight = graph.links[linkis[0]].weight + 1;
                if(weight > 3) // Max 3 links
                    return -1; // skip
                linkis.forEach(function(l) {
                    graph.links[l].weight = weight;
                });
            }
            
            // Turn around when flow is negative
            if(d.flow == -1) {
                var tmp = src;
                src=trg;
                trg=tmp;
                d.flow = 1;
            }
            
            graph.links.push({
                "source": src,
                "target": trg,
                "flow": d.flow,
                "description": d.description,
                "reference": d.reference,
                "notes": d.notes,
                "tools": d.tools,
                "type": d.type,
                "links": d.links,
                "weight": weight
            });
        },
        // Build the UI
        function(error, data) {
            // Create layout
            force = d3.layout.force()
                .linkDistance(link_dist)
                .linkStrength(.02)
                .charge(-120)
                .gravity(.015)
                .size([width, height])
                .on("tick", tick);
            force
                .nodes(graph.nodes)
                .links(graph.links)
                .start();
            update();
        });
    return this;
}

/* Main update function */
function update() {
    // Add/update links
    var link = svg.selectAll('.link')
        .data(graph.links);
    
    link.exit().remove();
    
    var linkEnter = link.enter().append('path')
        .attr('class', function(d) {
            return "link " + TYPE_CLASS[d.type];
        })
        .attr({
            "marker-end":   function(d) {
                return "url(#rarrow"+d.type+")";
            },
            "marker-start": function(d) {
                if(d.flow == FLOW_CONNECT)
                    return "url(#larrow"+d.type+")";
            }})
        .on("click", clicklink);

    /* Ideally this is done with positional markers;
     * tick() updates their position given the direction.
     * See https://www.w3.org/TR/svg-markers/.
     * 
     *linkEnter.append('marker')
     *        .attr({
     *         'href': 'url(#rarrow)',
     *         'position': '90%'});
     */
    
    // Add/update nodes
    var node = svg.selectAll('.node')
        .data(graph.nodes);
    
    node.exit().remove();
    
    var nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .on("click", clicknode)
        .call(force.drag);
    
    nodeEnter.append("ellipse") // Add ellipse
        .attr({
            "rx": function(d) {return d.rx;},
            "ry": function(d) {return d.ry;}});
    
    nodeEnter.append("text")    // Add text
        .attr({
            "dy": 5,
            "text-anchor": "middle",
            "class": "nodetxt"})
        .text(function(d) { return d.name; });
}

/* Main timestep function */
function tick() {
    var node = svg.selectAll('.node');
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
    
    var link = svg.selectAll('.link');
    link.attr("d", function(d) {
        var clink = correctLink(d, link_spread);
        if(d.weight == 1 || d.flow == FLOW_CONNECT) 
            return pathline(clink);
        else
            return patharc(clink);
    }).style("opacity", function(d) {
            var clink = correctLink(d, link_spread),
                invmindist = 0.03; // 3/link_dist
        /* Some useful debugging:
           if(d.tools=="cgDNA")
             $("#debug").text(
             clink.x0.toFixed(1)+","+clink.y0.toFixed(1)+","+
             clink.x1.toFixed(1)+","+clink.y1.toFixed(1)+","+
             clink.dx.toFixed(1)+","+clink.dy.toFixed(1)+","+
             clink.dr.toFixed(1)+","+(invmindist*clink.dr).toFixed(1));
             return Math.min(1.0, invmindist*clink.dr);
        */
        });    
}

function refresh() {
    /* Let the layout adapt to changes */
    force.alpha(1.0);
}

/* Callback functions */
function clicknode(d) {
    if (d3.event.defaultPrevented) return; // ignore drag
    metadata(d, "node");
    if (d3.event.shiftKey) {
        d.fixed = !d.fixed;
    }
    refresh();
}

function clicklink(d) {
    metadata(d, "link");
}

/* Location functions */
function graphApply(locations, scale) {
    var node = svg.selectAll('.node');
    node.attr({
        cx: function(d){d.fixed=true; d.conf=true; return d.x;},
        cy: function(d){return d.y;}
    });
    node.transition().duration(1000).attr({
        cx: function(d) {
            var loc = locations[d.name];
            if(!loc) {
                console.log(d.name+" not found in locations!");
                return width/2;
            }
            return scale*loc[0]+width/2;
        },
        cy: function(d) {
            var loc = locations[d.name];
            if(!loc) {
                console.log(d.name+" not found in locations!");
                return height/2;
            }
            return 0.9*height-scale*loc[1];
        }})
        .each("end", function(d) {d.px=d.x; d.py=d.y; d.conf=false;});
    refresh();
}

function pentagon() {
    var a=0.32,
        b=0.53,
        c=0.62,
        d=0.9,
        scale=400;
    var locations = {
        "MNase": 	 [0,  d],
        "RNA-seq": 	 [-a, c*0.7],
        "Histone marks": [0,  c*0.75],
        "ChIP-seq":		 [b,  c],
        "Hi-C":		 [a,  a], 
        "Models (bp)": [-b, c],
        "3D chromatin":	 [a,  0],
        "Models (kbp)":[-a, 0],
        "DNA MD":	 [-a, d],
        "FISH":		 [-a*0.6, c*0.4]};
    graphApply(locations, scale);
}

function hexagon() {
    var a=0.5,
        b=1.0,
        c=1.0,
        d=1.4*c,
        scale=250;
    var locations = {
	"MNase":	 [a,  d],
	"RNA-seq":	 [-a, c*0.7],
	"Histone marks": [0,  c*0.75],
	"ChIP-seq":		 [b,  c],
	"Hi-C":		 [a,  a*1.1], 
	"Models (bp)": [-b, c],
	"3D chromatin":	 [a,  0],
	"Models (kbp)":[-a, 0],
	"DNA MD":	 [-a, d],
	"FISH":		 [-a*0.7, c*0.45]};
    graphApply(locations, scale);
}

function circle(random = false) {
    var scale=200,
        locations = {},
        th;
    graph.nodes.forEach(function(d,i,A) {
        if(random)
            th = Math.random() * 2 * PI;
        else
            th = i/A.length * 2 * PI;
        locations[d.name] = [
            Math.cos(th),
            Math.sin(th)+1];
    });
    graphApply(locations, scale);
}

function release() {
    graph.nodes.forEach(function(d) {d.fixed=false;});
    refresh();
}
