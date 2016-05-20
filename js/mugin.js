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
 * TODO: 
 *  1. directional links DONE v0.2
 *  2. double links      DONE v0.2
 *  3. improved metadata
 *  4. editable metadata
 *  5. graph bidimensional sorting
 *  6. multiple entries per link
 *
 */

/* Constants */
var PI = 3.1415;

var NTYPES = 3,
    TYPE_TODO = 0,
    TYPE_DONE = 1,
    TYPE_MAYBE= 2,
    TYPE_CLASS=["todo", "done", "maybe"];

/* Configuration */
var width = 600,
    height = 500,
    transitionDuration = 1000, // ms
    link_dist = width/4.0,
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
function addnode(graph, nodename) {
    /* XXX move to the graph prototype.
     * Add a node to the graph 
     */

    if(graph.nodelist.indexOf(nodename) >= 0)
        return graph.nodelist.indexOf(nodename);
    
    var ret = graph.nodelist.push(nodename);
    var th  = Math.random() * 2 * PI;
    graph.nodes.push({
        "x": (1+Math.sin(th))*width/2,
        "y": (1+Math.cos(th))*width/2,
        "rx": Math.max(30, nodename.length*4),
        "ry": 30,
        "name": nodename});
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
        dr : Math.sqrt(dx * dx + dy * dy)
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
    return "<h3>"+d.name+"</h3>";
}

function textifylink(d) {
    // Return text description of link
    return "<h3>"+d.source.name+"&mdash;"+d.target.name+"</h3><dl>"+
        "<dd>Description: " + d.description + "</dd>"+
        "<dd>Reference: " + d.reference + "</dd>"+
        "<dd>Tools: " + d.tools + "</dd>"+
        "</dl>";
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
	    "refX":0,
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
function datagraph(id, tsv) {
    svg = d3.select(id).append("svg")
        .attr("width",  width)
        .attr("height", height);

    make_markers();
    
    graph.nodelist = []; // temporary structure to accumulate nodes
    graph.linklist = []; // temporary structure to count links
    graph.nodes = [];
    graph.links = [];
        
    d3.tsv(
        tsv,
        function(d) {
            // Add nodes
            var src = addnode(graph, d.data1),
                trg = addnode(graph, d.data2);
            
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
            
            // Compute derived variables
            var flow= 1;
            if(d.flow == "<-") {
                var tmp = src;
                src=trg;
                trg=tmp;
            }else if(d.flow == "<->") {
                flow = 2;
            }
            
            /* Types:
             *  1. available tools: done
             *  2. demonstrated to be relevant, but no available tools: todo
             *  3. potentially relevant: maybe
             */  
            var type = TYPE_TODO;
            if(d.reference == "XXX")
                type = TYPE_MAYBE;
            else if(d.tools != "")
                type = TYPE_DONE;            
            
            graph.links.push({
                "source": src,
                "target": trg,
                "flow": flow,
                "description": d.description,
                "reference": d.reference,
                "notes": d.notes,
                "tools": d.tools,
                "type": type,
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
            update();
        });
    return this;
}

/* Main update function */

function update() {
    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();
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
                if(d.flow == 2)
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
    var link = svg.selectAll('.link');
    link.attr("d", function(d) {
        var clink = correctLink(d, link_spread);
        if(d.weight == 1 || d.flow == 2) 
            return pathline(clink);
        else
            return patharc(clink);
    })
        .style("opacity", function(d) {
            var clink = correctLink(d, link_spread),
                invmindist = 0.03; // 3/link_dist
            // if(d.tools=="cgDNA")
            //     $("#debug").text(
            //         clink.x0.toFixed(1)+","+clink.y0.toFixed(1)+","+
            //         clink.x1.toFixed(1)+","+clink.y1.toFixed(1)+","+
            //         clink.dx.toFixed(1)+","+clink.dy.toFixed(1)+","+
            //         clink.dr.toFixed(1)+","+(invmindist*clink.dr).toFixed(1));
            return Math.min(1.0, invmindist*clink.dr);
        });
    
    var node = svg.selectAll('.node');
    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}


/* Callback functions */

function clicknode(d) {
    console.log(d);
    if (d3.event.defaultPrevented) return; // ignore drag
    $("#selector-hp").html(textifynode(d));
    if (d3.event.shiftKey) {
        d.px = width/2;
        d.py = height/2;
        var node = svg.selectAll('.node');
        node.each(function(d) {d.fixed = false;});
        d.fixed = true;
        update();
    }
}

function clicklink(d) {
    console.log(d);
    $("#selector-hp").html(textifylink(d));
}
