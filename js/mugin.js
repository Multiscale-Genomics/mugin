/*
 * datagraph.js 
 *
 *  Copyright (C) 2016 Marco Pasi <mf.pasi@gmail.com> 
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 * v0.1 160518
 *
 */

var width = 600,
    height = 500,
    transitionDuration = 1000, // ms
    svg, graph = {}, force;

function capitalize(string) {
    return string.substr(0, 1).toUpperCase() + string.substr(1);
}

// XXX Use the function.call(instance) pattern
//     to wrap all this into an object with an
//     assigned id, tsv; then the _this pattern
//     can be used for callbacks.
function datagraph(id, tsv) {
    svg = d3.select(id).append("svg")
        .attr("width",  width)
        .attr("height", height);
    
    graph.nodelist = [];
    graph.nodes = [];
    graph.links = [];
        
    d3.tsv(
        tsv,
        function(d) {
            if(graph.nodelist.indexOf(d.data1) == -1)
                graph.nodelist.push(d.data1);
            if(graph.nodelist.indexOf(d.data2) == -1)
                graph.nodelist.push(d.data2);
            var src = graph.nodelist.indexOf(d.data1);
            var trg = graph.nodelist.indexOf(d.data2);
            var flow= 1;
            if(d.flow == "<-") {
                var tmp = src;
                src=trg;
                trg=tmp;
            }else if(d.flow == "<->") {
                flow = 2;
            }
            graph.links.push({
                "source": src,
                "target": trg,
                "flow": flow,
                "description": d.description,
                "reference": d.reference,
                "notes": d.notes,
                "tools": d.tools
            });
        },
        // Build the UI
        function(error, data) {
            // Make nodes from nodelist
            graph.nodelist.forEach(
                function(d, i, a) {
                    var j = Math.random() * a.length;
                    graph.nodes.push({
                        "x":(1+Math.sin(j*6.28/a.length))*width/2,
                        "y":(1+Math.cos(j*6.28/a.length))*width/2,
                        "name":d});
                });
            // Create layout
            force = d3.layout.force()
                .linkDistance(width/4.0)
                .linkStrength(.02)
                .charge(-120)
                .gravity(.015)
                .size([width, height])
                .on("tick", tick);
            update();
        });
    return this;
}

function update() {
    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();
    // Add/update links
    var link = svg.selectAll('.link')
        .data(graph.links);
    link.exit().remove();
    var linkEnter = link.enter().append('line')
        .attr('class', function(d) {
            var cl = "link";
            if(d.reference == "XXX")
                cl += " new";
            else if(d.tools != "") {
                cl += " old";
            }
            return cl;
        })
        .on("click", clicklink);
    linkEnter.append("marker")
	.attr({
	    "id":"arrow",
	    "viewBox":"0 -5 10 10",
	    "refX":5,
	    "refY":0,
	    "markerWidth":4,
	    "markerHeight":4,
	    "orient":"auto"
	})
        .append("path")
	.attr("d", "M0,-5L10,0L0,5")
        .attr("class","arrow");
    
    // Add/update nodes
    var node = svg.selectAll('.node')
        .data(graph.nodes);
    node.exit().remove();
    var nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .on("click", clicknode)
        .call(force.drag);
    nodeEnter.append("ellipse")
        .attr("rx", function(d) {
            return Math.max(30, d.name.length*4);
        })
        .attr("ry", 30);
    nodeEnter.append("text")
        .attr("dy", 5)
        .attr("text-anchor", "middle")
        .attr("class", "nodetxt")
        .text(function(d) { return d.name; });
}

function tick() {
    var link = svg.selectAll('.link');
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    var node = svg.selectAll('.node');
    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function clicknode(d) {
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
    $("#selector-hp").html(textifylink(d));
}

function textifynode(d) {
    return "<h3>"+d.name+"</h3>";
}

function textifylink(d) {
    return "<h3>"+d.source.name+"&mdash;"+d.target.name+"</h3><dl>"+
        "<dd>Description: " + d.description + "</dd>"+
        "<dd>Reference: " + d.reference + "</dd>"+
        "<dd>Tools: " + d.tools + "</dd>"+
        "</dl>";
}
