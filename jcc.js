

jQuery.fn.jcc_findAndSelf = function(selector) {
	return this.find(selector).add(this.filter(selector));
};

function printDebug(msg) {
	(console) ? console.log(msg) : alert(msg);
}


/*
 JccWidget = {
 	index,
 	blueprint,
 	refreshFunc
 }
 
 
 */


/*
 * A structure representing a jcc-related bundle of elements.
 * A new bundle is created for every jcc parent node (a node with class="jcc"), 
 * and contains information about it.
 */
var JccBundle = function(index, blueprintNode, visibleNode) {
	//An identifier for the bundle.
	//This identifier is assigned using jcc.nodeIndexCounter.
	this.index = index;
	
	//The original node, with jcc:attributes.
	//This node is kept in the memory and isn't visible to the user or in the DOM after the original initialization. 
	this.blueprintNode = blueprintNode;
	
	//The node that will be visible to the user.
	//This node is manipulated in order to show the desired result.
	this.visibleNode = visibleNode;
};

/**
* JCC Dictionary
*/
//A dictionary
var jccDictionary = function(dictionary, dictionaryName, node, alias, enumVar) {
	//the key-value map
	this.dictionary = dictionary;
	
	//the name of the dictionary
	this.dictionaryName = dictionaryName;
	
	//the node that contained the dictionary.
	this.node = node;
	
	//an alias for the dictionary. (defaults to dictionaryName)
	alias = (alias=="") ? null : alias;
	this.alias = alias || dictionaryName;
	
	//an alias for the enumerated index (defaults to alias_index)
	enumVar = (enumVar=="") ? null : enumVar;
	this.enumVar = enumVar || this.alias+"_index";
};

jccDictionary.prototype = {
	/*
	 * Returns true iff the current dictionary has the name or alias of "name".
	 */
	"isNamed": function(name) {
		return (this.dictionaryName == name || this.alias == name);
	}
};

//A stack of dictionaries
var jccDictionaryStack = function () {
	//A stack of dictionaries, where each dictionary is an instance of jccDictionary.
	//When traversing a tree of jcc elements, a new dictionary is pushed whenever a "jcc:data" attribute is found,
	//and popped whenever the traverser finishes handling the element that contained the "jcc:data" attribute.
	//At every given moment, the dictionary at the top of the stack is the current dictionary.
	this.__dictionaries = [];
	
	jccDictionary.apply(this, [null,null,null,null,null]);
};

//Dictionary stack implementation
jccDictionaryStack.prototype = {
	
	/*
	 * Push a dictionary into the stack.
	 */
	"push" : function(dictionary,dictionaryName, node, alias, enumVar) {
		this.__dictionaries.push(new jccDictionary(dictionary, dictionaryName, node, alias, enumVar));
		this.refresh();
	}, 
	
	/*
	 * Pop a dictionary from the stack.
	 */
	"pop" : function() {
		this.__dictionaries.pop();
		this.refresh();
	}, 
	
	//append the correct dictionary's members to this dictionary stack.
	//i.e. instead of accessing this.peek().dictionaryName we can use this.dictionaryName
	"refresh" : function () {
		if (this.__dictionaries != null && this.__dictionaries.length > 0) {
			var curDict= this.__dictionaries[this.__dictionaries.length - 1];
			jccDictionary.apply(this, [curDict.dictionary, curDict.dictionaryName, curDict.node, curDict.alias, curDict.enumVar]);
		} else {
			//dictionary stack is empty
			jccDictionary.apply(this, [null,null,null,null,null]);
		}
	}, 
	
	/*
	 * Returns the upper-most dictionary of the stack.
	 */
	"peek" : function () {
		if (this.__dictionaries != null && this.__dictionaries.length > 0) {
			return this.__dictionaries[this.__dictionaries.length - 1];
		}
		else {
			return null;
		}
	}, 
	
	/*
	 * Given a dictionary name or alias, return the index (=location on the stack) of the dictionary.
	 * Stack top gets index 0, stack bottom gets index "stackLength-1".
	 * Returns -1 if no dictionary with name dictionaryName found.
	 */
	"getDictionaryIndexByName": function(dictionaryName) {
		for (var i=this.__dictionaries.length - 1; i >= 0; i--) {
			if (this.__dictionaries[i].alias == dictionaryName || this.__dictionaries[i].dictionaryName == dictionaryName) {
				return i;
			}
		}
		return -1;
	},
	
	/*
	 * Returns a dictionary according to its index, or null for a illegal index. 
	 */
	"getDictionaryByIndex": function(index) {
		if (index >= 0 && index < this.__dictionaries.length) {
			return this.__dictionaries[index];
		}
		return null;
	},
	
	/*
	 * Returns the appropriate definition for the value at dictionary[rowCout][dictKey], or "undefined!" if not defined.
	 * if dictKey is not found in level i but it does match the enumeration token (enumVar) then the one-based
	 * rowCount is returned (i.e. rowCount+1).
	 * If (dictIndex == -1), the stack is searched from top to bottom (I.E. the definition of the topmost dictionary
	 * containing the value is returned). Otherwise, the value definition is searched for in the dictIndex dictionary.
	 * Assumes dictIndex is -1 or a valid dictionary index.
	 */
	"getDefinition" : function (rowCount, dictKey, dictIndex) {
		var hi=(dictIndex==-1) ? this.__dictionaries.length - 1 : dictIndex;
		var lo=(dictIndex==-1) ? 0 : dictIndex;

		try {
			//Handle simple arrays each iteration just returns an entry of the array
			if (dictIndex==-1) {
				var dictIndexLocal=this.getDictionaryIndexByName(dictKey);
				if (dictIndexLocal!=-1) {
					// single value in array
					return this.__dictionaries[dictIndexLocal].dictionary[rowCount];
				}
			}
			//iterate over dictionaries
			for (var i=hi; i >= lo; i--) {
				//handle real values in dictionary
				if (typeof(this.__dictionaries[i].dictionary[rowCount][dictKey]) != "undefined") {
					// if the value is defined in this dictionary
					return this.__dictionaries[i].dictionary[rowCount][dictKey];
				} else {  //handle enumeration values
					// if key was not found in the dictionary, evaluate it as the enumeration variable
					var enumVar=this.__dictionaries[i].enumVar;
					if (enumVar==dictKey) {
						return rowCount+1; // one-based index since it's probably for display
					}
				}
			}
		} catch (e) {return e;}
		return "undefined!";
	},
	
	/**
	 * Returns true iff the stack is empty.
	 */
	isEmpty: function() {
		return (this.__dictionaries == 0);
	}
};

/**
 * For a given array of ranges, returns a sorted and compact array
 * with overlaping rnages merged into one range
 * [ [1,4], [3,5], [6,9], [11,14] ]  -->  [ [1,9], [11,14] ]
 * @param rangesArray and array of [lo, hi] objects where lo and hi are integers
 * @return
 */
var jccCompactRangesArray = function (rangesArray) {
	if (!rangesArray || rangesArray.length==0)
		return rangesArray;
	
	rangesArray.sort(function(a,b) {return a[0]-b[0];}); //sort by lower part of the range
	var compactArray=new Array();
	//get lo,hi for first element, asuming an array of [lo, hi] objects
	var llo=rangesArray[0][0], lhi=rangesArray[0][1];
	var tlo, thi;
	//get rid of overlaps
	for (var i=1; i<rangesArray.length; ++i) {
		var tmpRange=rangesArray[i];
		tlo=tmpRange[0];
		thi=tmpRange[1];
		if (tlo<=lhi+1) { //since these are integers a gap of one is continuous
			if (thi>lhi) { //expand the range & merge the subsets
				lhi=thi;
			} //else: [tlo,thi] is fully contained in [llo,lhi]
			continue;
		}//else
		compactArray.push([llo,lhi]);
		llo=tlo;
		lhi=thi;
	}
	//insert last range
	compactArray.push([llo,lhi]);
	return compactArray;	
};
/*
 * 
 * Creates a new function filter around the 
 */
var jccIndexFilterFactory = function (filterString) {
	/**
	 * Returns a function that given the index and value evaluates it against the filter
	 * string and returns true iff the index is covered by the filter.
	 * 
	 * Note: the filterString param should either be a straight-forward filter (no negation)
	 * 		or a negation ["not(...)"] filter
	 * 
	 * Example:
	 * 	for the filterString "all" the returned function should return always True
	 * 	for the filterString "none" the returned function should return always False
	 * 	for the filterString "even" the returned function should return True iff index is even
	 * 	for the filterString "odd" the returned function should return True iff index is odd
	 * 	for the filterString "1,2,4-7,5" the returned function should return True only for an index in the group {1,2,4,5,6,7}
	 * 	for the filterString "not(1,2,4-7,5)" the returned function should return True only for an index not in the group {1,2,4,5,6,7}
	 * 	for the filterString "function(index, value) {..}" the returned function should return True iff the given function would return True for (index, value)
	 * 	for the filterString "functionPointer" the returned function should return True iff the function given by the pointer would return True for (index, value)
	 * 
	 */
	//filter logic according to string
	
	var ranges;
	var num1, num2, rangeRes, i;
	//Capture either one group (for a single number) or two groups (in case of a numeric range "n-m")
	var noFilterTest=new RegExp(/^\s*(?:repeat|all)\s*$/i);
	var blockFilterTest=new RegExp(/^\s*(?:none\s*)?$/i);
	var evensFilterTest=new RegExp(/^\s*(even[s]?)\s*$/i);
	var oddsFilterTest=new RegExp(/^\s*(odd[s]?)\s*$/i);
	var rangeFilterTest=new RegExp(/^\s*\d+\s*(?:[-]\s*\d+\s*)?(?:[,]\s*\d+\s*(?:[-]\s*\d+\s*)?)*$/);
	var rangeSplitter=new RegExp(/^\s*(\d+)\s*(?:[-]\s*(\d+)\s*)?$/);
	var negationFlag=false, negationMatch = filterString.match(/^\s*not\s*\(([^\)]+)\)\s*$/i);
	
	//check if this is a negation filter
	if (negationMatch!== null) {
		negationFlag=true;
		filterString = negationMatch[1]; //get the first group matched from the regExp - i.e. the ranges
	}

	// Basic filters
	//filter nothing. matches "all" or "repeat"
	if (noFilterTest.test(filterString))
		return function() {return !negationFlag;};
	//filter everything. matches "none" or ""
	if (blockFilterTest.test(filterString))
		return function() {return negationFlag;};
	//filter odds out (leave only evens) matches "even" or "evens"
	if (evensFilterTest.test(filterString))
		return function(index) {return index%2==0 ? !negationFlag : negationFlag;};
	//filter evens out (leave only odds) matches "odd" or "odds"
	if (oddsFilterTest.test(filterString))
		return function(index) {return index%2==1 ? !negationFlag : negationFlag;};
	
	//advanced filters
	
	//handle range filter
	if (rangeFilterTest.test(filterString)) {
		ranges = filterString.split(',');
		for  (i=0;i<ranges.length; ++i){
			
			rangeRes=rangeSplitter.exec(ranges[i]);
			if (rangeRes) {
				//temporarily store the two values
				num1 = parseInt(rangeRes[1]); // the first group will always exists
				num2 = ((rangeRes[2]!==undefined) && (rangeRes[2]!=="")) ? parseInt(rangeRes[2]) : num1; 
				//store the range by order [lower,higher]
				ranges[i] = (num1 < num2) ? [num1,num2] : [num2, num1];
			} else {
				printDebug("filter range is not well-defined");
			}
		}
		
		//ranges array optimizations
		ranges=jccCompactRangesArray(ranges);
	
		return function(index) {
			var found=false;
			for (var i=0;i<ranges.length; ++i){
				if (index>=ranges[i][0]) {
					if (index<=ranges[i][1]) {
						found=true;
						break;
					}
				} else {
					break; //the ranges array is sorted so no need to continue.
				}
			}
			return (negationFlag) ? !found : found;
		};
	} else { //if we got here we assume this is a function filter, so we return it
		return new Function("return " +filterString + ";").call(window);
	}
};

/**
 * JCC Main Class
 */
var jcc = function () {
		
	//A stack of dictionaries.
	//When traversing a tree of jcc elements, a new dictionary is pushed whenever a "jcc:data" attribute is found,
	//and popped whenever the traverser finishes handling the element that contained the "jcc:data" attribute.
	//At every given moment, the dictionary at the top of the stack is the current dictionary.
	this.dictStack = new jccDictionaryStack();
		
	//A key-value map of handlers, where function "value" should be called on a given node if this node has a "key" attributes.
	//This map contains handlers that should be called on the node *before* its children are traversed.
	this.preHandlers = {};
	
	//A key-value map of handlers, where function "value" should be called on a given node if this node has a "key" attributes.
	//This map contains handlers that should be called on the node *after* its children are traversed.
	this.postHandlers = {};
	
	//A key-value map of handlers, where function "value" should be called on a given node if this node has a "key" attributes.
	//This map contains handlers that should be called on widgets: Custom defined nodes that contain the "jcc" prefix (E.G <jcc:myWidget />).
	this.widgetHandlers = {};
	
	//A table of all jcc parent nodes, where the key is a unique numeric index (obtained using jcc.nodeIndexCounter and
	//the value is a JccBundle representing the node.
	this.bundleTable = [];
	
	//A table of all jcc parent widgets, where the key is a unique numeric index (obtained using jcc.widgetIndexCounter and
	//the value is a JccWidget representing the widget.
	this.widgetTable = [];
	
	//A list of jcc:attribute attributes that shouldn't be removed by jcc.removeJccAttributes.
	this.jccPermanentAttr = [];
	
	//Perform actions that may occur before page initialization
	this.preInit();    
	
	//A mapping of "DOM id"->"counter", used to assign unique ids to each DOM element. 
	this.tempIdMapping = {};

};

  // ///////////////////////////////////////////////////
 // Static functions:                               //
/////////////////////////////////////////////////////


/*
 * Returns a string equal to str, except for str.charAt(index) set to character chr.
 */
jcc.setCharAt = function(str, index, chr) {
	if(index > str.length-1) return str;
	return str.substr(0,index) + chr + str.substr(index+1);
};

//A static counter which is incremented for each jcc parent node.
jcc.nodeIndexCounter = 1;

//A static counter which is incremented for each jcc parent widget.
jcc.widgetIndexCounter = 1;

/*
 * Constants
 */
jcc.CONSTANTS = {
	//types of handlers
	HANDLER_TYPES: {PRE_HANDLER: 0, POST_HANDLER: 1, WIDGET: 2}, 
	
	//each cloned node's id will receive this prefix, in order to differentiate from the visible node (which will have the original id) 
	CLONED_NODE_ID_PREFIX: "jcc__", 
	
	//each cloned node will receive this class
	CLONED_NODE_CLASS: "jccClonedElement",
	
	//each visible node will receive this class
	VISIBLE_NODE_CLASS: "jccVisibleElement"
	
};

jcc.localStorageMgr = {
		getAsObject: function (key) {
	    var retVal;
	    if (jcc.localStorageMgr.isSupported()) {
	        try{
	            retVal = $.parseJSON(jcc.localStorageMgr.getValue(key));
	            if (retVal===null) {
	                retVal=[];
	            }
	        } catch (e) {
	            retVal = [];
	        }
	    } else retVal=[];
	    
	    return retVal;
	},
	
	getValue: function (key) {
	    var retVal;
	    if (jcc.localStorageMgr.isSupported()) {
	        try{
	            retVal = window.localStorage[key];
	        } catch (e) {
	            retVal = null;
	        }
	    } else retVal=null;
	    
	    return retVal;
	},
	
	setValue: function (key, value) {
	    if (jcc.localStorageMgr.isSupported()) {
	        try{
	            window.localStorage[key] = value;
	        } catch (e) { }
	    }
	},
	
	
	appendToArray: function (key,data) {
	    if (jcc.localStorageMgr.isSupported()) {
	    	try {
		        var curVal=$.parseJSON(jcc.localStorageMgr.getValue(key));
		        curVal=curVal || [];
		        if (typeof curVal=="object") {
		            curVal.push(data);
		            //store back
		            jcc.localStorageMgr.setValue(key, JSON.stringify(curVal));
		        }
	    	} catch (e) { }
	    	
	    }
	}, 
	
	isSupported: function() {
		return (typeof window.localStorage != "undefined");
	}
};

  /////////////////////////////////////////////////////
 // Prototype functions:                            //
/////////////////////////////////////////////////////


jcc.prototype = {
	/**
	 * API Functions
	 */
	
	/*
	 * Register a handler for an attribute.
	 * jccAttribute: The attribute to assign a handler to , not including the "jcc:" prefix.
	 * functionRef: A reference to a function which will be called when the attribute is met.
	 * handlerType: The type of the handler: Pre-Handler, Post-Handler, Widget etc. 
	 */
	registerHandler: function(jccAttribute, functionRef, handlerType) {
		if (jccAttribute && functionRef && (!isNaN(handlerType))) {
			
			var handlerArray = null;
			switch (handlerType) {
			case jcc.CONSTANTS.HANDLER_TYPES.PRE_HANDLER:
				handlerArray = this.preHandlers;
				break;
			case jcc.CONSTANTS.HANDLER_TYPES.POST_HANDLER:
				handlerArray = this.postHandlers;
				break;
			case jcc.CONSTANTS.HANDLER_TYPES.WIDGET:
				handlerArray = this.widgetHandlers;
				break;
			default:
				handlerArray = null;
				break;
			}
			if (handlerArray != null) {
				handlerArray["jcc:"+jccAttribute.toLowerCase()] = functionRef;
			}
		}
		else {
			printDebug("Error: registerHandler received bad parameters.");
		}
	},
	
	/*
	 * Removes the elements specified by the "nodeIdsToRefresh" argument, and rebuilds them according to the original cloned elements
	 * saved at the original initialization.
	 * "nodeIdsToRefresh" can be a single id, an array of ids or null (meaning all elements should be refreshed).
	 * callback is an *optional* function pointer to be called upon completion.
	 * 		It receives the final node as a parameter.
	 * rebuild is an *optional* function to be called before the node is refreshed.
	 * 		It receives the blueprint node as a parameter and is able to modify it.
	 */
	refresh: function(nodeIdsToRefresh, callback, rebuild) {
		var me = this;
		window.setTimeout(function(){me.refreshFunc(nodeIdsToRefresh,callback, rebuild);}, 10);
	},
	
	/**
	 * Non-API Functions
	 */
	
	/*
	 * See jcc.refresh(nodeIdsToRefresh).
	 */
	refreshFunc: function(nodeIdsToRefresh, callback, rebuild) {
		var me = this;
		var typeOfArgument = typeof nodeIdsToRefresh;
		var nodesToRefresh= [];
		var callbackArray = null;
		
		if (nodeIdsToRefresh != null && typeOfArgument != "undefined") {
			if (typeOfArgument == "string") {
				//single id
				var nodeToRefresh = $("#"+nodeIdsToRefresh);

				nodesToRefresh.push(nodeToRefresh);
			}
			else if (typeOfArgument == "object") {
				//array of ids
				var nodeToRefresh;
				if (nodeIdsToRefresh instanceof Array) {
					$.each(nodeIdsToRefresh, function(index, nodeId) {
						if (typeof nodeId == "string") {
							nodeToRefresh = $("#"+nodeId);
						} else {
							//it's the node itself in an array
							nodeToRefresh = $(nodeId);
						}
	
						nodesToRefresh.push(nodeToRefresh);
					});
				} else {
					//it's the node itself
					nodesToRefresh.push($(nodeIdsToRefresh));
				}
			}
		}
		else {
			//no parameter supplied, all nodes should be refreshed.

			$(".jcc").each(function() {
				nodesToRefresh.push($(this));
			});
		}
		
		if (callback) {
			callbackArray =new Array();
		}
		
		$.each(nodesToRefresh, function(index, nodeObj) {
			var nodeIndex = me.getJccNodeAttribute(nodeObj.get(0), "nodeindex");
			var parentWidgetIndex = me.getJccNodeAttribute(nodeObj.get(0), "parentwidgetindex");
			window.clearTimeout(nodeObj.attr("jccTimeout")); //remove any outstanding jcc timeouts

			if (nodeIndex) {
				if (parentWidgetIndex  && me.widgetTable[parentWidgetIndex].refreshFunc) {
					me.widgetTable[parentWidgetIndex].refreshFunc.apply(window, [nodeObj]);
				} else {
					nodeObj.remove();
				}

				var bluePrintNode = me.bundleTable[nodeIndex].blueprintNode;
				if (rebuild) {
					rebuild(bluePrintNode);
				}
				var newVisibleNode = (bluePrintNode.clone().insertAfter($("#jcc_node_"+nodeIndex)))[0];
				me.bundleTable[nodeIndex].visibleNode = me.recurse.apply(me,[newVisibleNode]);
				
				var visibleElement = $(me.bundleTable[nodeIndex].visibleNode);
				if (visibleElement.html().indexOf("#{=") != -1) {
					me.replaceLiterals.apply(me, [visibleElement]);
				}

				if (callbackArray!=null) {
					callbackArray.push(newVisibleNode);
				}
			}
			else {
				printDebug("Error: Trying to refresh node with no jcc:nodeindex attribute.");
			}
		});
		
		//assuming the above is synchronized
		//Call the callback function 
		if (callback) {
			callback.call(window, callbackArray);
		}
	},
	
	/* 
	 * Things that can be done before the DOM finishes loading 
	 */
	preInit: function() {
		//PreHandlers:
		this.registerHandler("repeat", this.handleRepeat, jcc.CONSTANTS.HANDLER_TYPES.PRE_HANDLER);
		this.registerHandler("data", this.handleData, jcc.CONSTANTS.HANDLER_TYPES.PRE_HANDLER);
		this.registerHandler("runOnce", this.handleRunOnce, jcc.CONSTANTS.HANDLER_TYPES.PRE_HANDLER);
		
		//Post Handlers
		this.registerHandler("callback", this.handleNothing, jcc.CONSTANTS.HANDLER_TYPES.POST_HANDLER); //special handler, is handled explicitly in code
		this.registerHandler("tempid", this.handleTempID, jcc.CONSTANTS.HANDLER_TYPES.POST_HANDLER);
		this.registerHandler("timeout", this.handleTimeout, jcc.CONSTANTS.HANDLER_TYPES.POST_HANDLER); //special handler, is handled explicitly in code
		
		//Widgets
		this.registerHandler("table", this.handleWidgetTable, jcc.CONSTANTS.HANDLER_TYPES.WIDGET);
		this.registerHandler("form", this.handleWidgetForm, jcc.CONSTANTS.HANDLER_TYPES.WIDGET);
	},
	
	/* 
	 * Things that must be done after the DOM finishes loading 
	 */
	init: function() {
		this.jccPermanentAttr.push("jcc:nodeindex");
		this.jccPermanentAttr.push("jcc:parentwidgetindex");
		
		this.handleNodes() ;
	},
		
	/* 
	 * The main function: handles all jcc-nodes. 
	 */
	handleNodes:function () {
		var me=this;
		
		//first convert widgets to conventional jcc syntax
		$(".jccWidget").each(function(){
			var newJccWidgetIndex = jcc.widgetIndexCounter++;
			$(this).attr('jcc:nodeindex',newJccWidgetIndex);
			
			var JccWidget = {};
			JccWidget.blueprint = this;
			
			me.widgetTable[newJccWidgetIndex] = JccWidget;
			
			me.handleWidget.apply(me, [this, newJccWidgetIndex]);
			$(this).remove();
			
		});
		//now we can call jcc on converted widgets and direct jcc-coded elements 
		
		$(".jcc").each(function(){
			var newJccNodeIndex = jcc.nodeIndexCounter++;
			
			$(this).attr('jcc:nodeindex',newJccNodeIndex);
			
			//keep the blueprints in a safe place
			var blueprintNode = me.clone.apply(me,[this, newJccNodeIndex]);
			
			
			//Change all "id" attributes to "jcc:tempid" attributes in the visible block.
			//The "tempid"s later become "id"s again, but duplicate ids (caused by "jcc:repeat"
			//get a static count suffix according to the "tempIdMapping" map.
			$(this).jcc_findAndSelf("*[id]").each(function(){
	            $(this).attr("jcc:tempid", $(this).attr("id"));
	            $(this).removeAttr("id");
	        });
			
			//modify this copy with all modifications 
			var visibleNode = me.recurse.apply(me,[this]);
			
			var visibleElement = $(visibleNode); 
			if (visibleElement.html().indexOf("#{=") != -1) {
				me.replaceLiterals.apply(me, [$(visibleNode)]);
			}
			
			me.bundleTable[newJccNodeIndex] = new JccBundle(newJccNodeIndex, blueprintNode, visibleNode);
		});
	},
	
	/*
	 * Responsible for calling the appropriate handler on a widget.
	 * If the handler returns a result, it will be treated as the new node and will be inserted
	 * to the DOM after the widget.
	 */
	handleWidget: function(node, widgetIndex) {
		//nodeName for <jcc:myWidget /> might be "jcc:myWidget" or "myWidget", browser dependent.
		var nodeName = node.tagName.toLowerCase();
		
		if (nodeName.search(/^jcc:/)!=0) {
			//unify names.
			nodeName = "jcc:"+nodeName;
		}
		
		var refreshFunc = $(node).attr("jcc:refresh");
		if (refreshFunc) {
			var evalRefreshFunction = new Function("var jccRefreshFunc = "+refreshFunc+"; return jccRefreshFunc;");
			evalRefreshFunction = evalRefreshFunction(); //"dereference" evalCallbackFunction, turning it into the callback function
			this.widgetTable[widgetIndex].refreshFunc = evalRefreshFunction;
		}
		
		if (typeof(this.widgetHandlers[nodeName.toLowerCase()]) != "undefined") {
			//if a handler was defined for this widget, call it.
			var newNode = this.widgetHandlers[nodeName.toLowerCase()].apply(this, [node]);
			
			if (newNode) {
				//if a result is returned by the handler, insert to DOM.
				newNode = $(newNode);
				
				newNode.attr("jcc:parentwidgetindex", widgetIndex);
				$(node).after(newNode);
			}
		}
	},
		
	/* 
	 * Clones a jcc-block and stores it before the block. The clone is used as a backup of the original block, and
	 * the block itself is modified during traversal.
	 */
	clone:function(node, newJccNodeIndex) {
		
		var element = $(node);
		
		var clonedElement = element.clone();
		$("<jcc:placeholder id='jcc_node_"+newJccNodeIndex+"' />").insertBefore(element);
		
		
		return clonedElement;
		
	},
	
	/*
	 * Recurse through the jcc-block and handle each node at a time.
	 */
	recurse: function(container) {
		var me=this;
		
		//A callback function for this container (if defined using jcc:callback="function" attribute).
		//This function is intended by the user to run after the container handling has been completed. 
		var callbackFunction = null;
		
		//call the pre-handlers
		this.handleAttributes.apply(this,[container, this.preHandlers]);
		//traverse children
		$.each($(container).children(), function(childIndex, childValue){
			me.recurse.apply(me, [childValue]);
		});
		
		//call the post-handlers.
		//if a callback function was defined for this container, it would be returned. Otherwise, null is returned.
		callbackFunction = this.handleAttributes.apply(this,[container, this.postHandlers]);

		//remove all "jcc:*" attributes, since after all handlers were called, they have no meaning.
		this.removeJccAttr.apply(this, [$(container)]);
		
		
		//if the container is equal to the current dictionary's node, the dictionary was pushed when we started to traverse this 
		//container and therefore should be popped when the traversing is done.
		if(container === this.dictStack.node) {
			this.dictStack.pop();
		}
		
		
		if (callbackFunction != null) {
			//if a callback function was defined, call it.
			this.execFunc(callbackFunction, window, [container]);	
		}
		
		return container;
		
	},
	

	/*
	 * Calls the appropriate handlers for each node, depending on its attributes.
	 * Returns the value of "jcc:callback" if defined, and null otherwise.
	 */
	handleAttributes: function(node, handlerArray) {
		//A callback function for this container (if defined using jcc:callback="function" attribute).
		var callbackFunction = null;
		
		if (node.attributes !== null) {

			//is the nodes content going to be repeated? 
			var shouldRepeat = false;
			var repeatAttribVal = null;
			
			
			var me=this;
			
			//iterate though all attributes and check  what should be done
			$.each(node.attributes, function(i, attrib){

				if (attrib !== undefined) {
					//name of the attribute
					var name = attrib.name.toLowerCase();
					//value of the attribute
					var value = attrib.value;
					
					if (name.search(/^jcc:/)==0) {
						//if this is a "jcc:" attribute

						if (handlerArray[name] !== undefined) {
							if (name == "jcc:repeat") {
								//this is a "repeat" attribute and should be handled last, after all other attributes were handled.
								shouldRepeat = true;
								repeatAttribVal= value;
							}
							else if (name == "jcc:callback") {
								//shouldn't be handled in this scope, is handled in this.recurse().
								//the callback function should be called after the element handling has been finished.
								//we save the value and return in.
								callbackFunction = value;
							}
							else {
								handlerArray[name].apply(me, [node, value]);
								
								if (name == "jcc:runonce") {
									//After "jcc:runonce" code is run once, we remove it so it wouldn't be run again in the future.
									$(node).attr("jcc:runonce","");
								}
							}
						}
					}
				}
			});
			
			if (shouldRepeat) {
				//the last thing to do is repeat, in needed.
				handlerArray["jcc:repeat"].apply(me, [node, repeatAttribVal]);
			}
		}
		
		return callbackFunction;
	},
	
	/*
	 * Helper method for executing code safely within a context with some args
	 * code: the JS code to execute
	 * context: the context inwhich the code should run (usually window)
	 * args: optinal arguments to transfer to the function
	 */
	execFunc: function(code, context, args) {
		context = context || window;
		args = args || [];
		var evalCBFunc = null;
		try {
			evalCBFunc = new Function("var f=null; try {f= "+code+";} finally {return f;}");
			//"dereference" evalCallbackFunction, turning it into the callback function
			evalCBFunc = evalCBFunc.apply(window, args); 
			if (typeof evalCBFunc=="function") {
				//call callback function with "window" as "this"
				//passing it the args as a parameter.
				evalCBFunc=evalCBFunc.apply(context, args); 
			}
		}
		catch (e) {
			printDebug("Function failed with error: "+e);
		}
		
		return evalCBFunc;
	}, 
	
	/*
	 * Replaces all "#{something}"'s in "value" with the "something" real value, taken from dicValue[something].
	 * if "something" is of the form "=expression" then it is evaluated as a JS varaible
	 */
	replaceLiteralsHelper: function(value) {
		//fix - - for "{}"'s being encoded to %7B%7D when in <a href="#{stuff}">.
		value = value.replace(/%7B/, "{");
		value = value.replace(/%7D/, "}");
		
		value = value.replace(/\[\]\./g,"@"); 
		
		//regex to return the "something" in "#{something}"
		var extractLiteralsRegex = /#\{([^}]*)\}/i;
		
		while (value.indexOf("#{") != -1) {

			
			//EXAMPLE:
			//Assume jcc:data="ourdata" or jcc:alias="ourdata".
			//Assume value = "<input value='#{ourdata.index}'>"
			//Assume dicValue = { index: "Why", value: "Because" }
			
			var valueMatch = value.match(extractLiteralsRegex);
			//now valueMatch = ["#{value}", "value"]
			
			if ((valueMatch != null) && (valueMatch.length > 1)) {
				
				var evalStr=$.trim(valueMatch[1]);
				
				if (evalStr.length==0) {
					//skip empty strings or whitespaces
					continue;
				}
				
				//get the replacement
				var dictionaryIndex = -1;
				var evalValue=null;

				//valueMatch[1] will start with a "=" for code that should be evaluated as is.
				//otherwise, it is treated as a dictionary value.
				if (valueMatch[1].charAt(0)!="=") {
					//the replacement is a dictionary value
					
					if (!this.dictStack.isEmpty())  { //no point in checking if no dictionaries available.
					
						//check to see if evalStr is of form "dataSource.data" (I.E. contains a dot).
						//if so, we wan't to access the dictionary "dataSource" directly, instead of using the stack logic.
						var firstDot = evalStr.indexOf(".");
						if (firstDot != -1) {
							//evalStr contains a dot. extract dictionary name and lookup the definition using this specific dictionary, if 
							//it exists.
							var dictionaryMatch = evalStr.match(/^([^\.]+)\..+/); //dictionaryMatch = ["dataSource.data", "dataSource"];
							if (dictionaryMatch!= null && dictionaryMatch.length > 1) {
								var dictionaryName = dictionaryMatch[1];
								dictionaryIndex = this.dictStack.getDictionaryIndexByName(dictionaryName);//will return -1 if not found
							}
							
						}
						
						if (dictionaryIndex != -1) {
							valueMatch[1] = valueMatch[1].substr(firstDot+1, valueMatch[1].length); //remove "dataSource."
							dicIndex = this.dictStack.getDictionaryByIndex(dictionaryIndex).currentRow;
						}
						else {
							dicIndex = this.dictStack.peek().currentRow;
						}
						
						evalValue = this.dictStack.getDefinition(dicIndex,valueMatch[1], dictionaryIndex);
					}
					
				} else {
					//this is code that should be executed, since it started with a "=".
					evalStr = evalStr.substr(1); //remove the "=".
				}

				///if no value (evalValue) was deduced from the string (evalStr)
				//try and deduce it by evaluating the string as JS code
				if (evalValue===null) {
					try {
						//eval with inner scope protection
						evalValue = this.execFunc(evalStr,window);
					} catch (e) {
							evalValue = e;
					}
				}
				//if code wasn't executable, now evalValue = "Because"
					
				value = value.replace(extractLiteralsRegex, evalValue);
				//now value = "<input value='Because'>"
			}
		}
		
		return value;
	},
		
	/*
	 * Replaces all "#{something}"'s in node with the "something" real value, taken from dicValue[something].
	 */
	replaceLiterals: function(node) {
		var me=this;
		
		//iterate through all node's attributes and handle each attribute separately
		$.each(node.get(0).attributes, function(i, attrib){
				var name = attrib.name;
				var value = attrib.value;
				
				if ((value != "null") && (value != "")) { //note the "null" string (as opposed to the null type) - due to IE behavior
					var newValue = me.replaceLiteralsHelper.apply(me, [value]);
					
					if (newValue !== value) {
						//update only if something changed.
						node.attr(name, newValue);
					}
				}
				
			});
			
		//now replace literals in node's innerHTML.
		var value = node.html();
		var newValue = this.replaceLiteralsHelper(value);
		if(newValue !== value) {
			//update only if something changed.
			node.html(newValue);
			
		}
	
	},
	
	/*
	 * Remove all "jcc:*" attributes from a node, except for those listed in this.jccPermanentAttr.
	 */
	removeJccAttr:function(element) {
		var me = this;
		
		//an array of attributes to be removed.
		var attrToRemove = [];
		
		//iterate through current element and search for "jcc:*" attributes.
		$.each(element.get(0).attributes, function(i, attrib){
			if (typeof(attrib) != "undefined"){  
				var name = attrib.name;
				if (name.search(/^jcc:/)==0) {
					if (($.inArray(name, me.jccPermanentAttr) == -1)) {
						//in order to avoid iterator invalidation
						attrToRemove.push(name);
					}
				}
			}
		});
		
		//remove what we found
		$.each(attrToRemove, function(i, name){
			element.removeAttr(name);
		});
	},
	
	/*
	 * Returns the value of a "jcc:attribute" attribute for the given node., or null if not found.
	 */
	"getJccNodeAttribute": function(node, attribute) {
		
		var regex = new RegExp("^jcc:"+attribute);
		var result = null;
		
		//traverse all attributes, looking for our specific attribute.
		$.each(node.attributes, function(i, attrib){
			if (typeof(attrib) != "undefined"){  
				var name = attrib.name;
				if (name.search(regex)==0) {
					result = attrib.value;
					return; //breaks foreach loop.			
				}
			}
		});
		return result;
	},
	
	
	 ////////////////////////////////////
	///        JCC HANDLERS          ///
   ////////////////////////////////////
	
	/*
	 * Handles "jcc:data":
	 * Extracts the dictionary and pushes it into the dictionary stack
	 */
	handleData: function(node, dataValue) {
		var data=undefined;
		var inlineVarRegExp = new RegExp(/^\s*(\w+)\s*=\s*(.*)\s*$/);
		var httpVarRegExp = new RegExp(/^\s*(http[s]*[:]\/\/\S+)\s*$/i);
		var dataName="data"; //default var name
		
		if (dataValue.match(/^\s*(\w*(\[\]\.|\.))*\w*\s*$/)) { 
			//handle regular variable name references
			
			dataValue = dataValue.replace(/\[\]\./g, "@");
			
			dataName = dataValue;
			
			if (dataValue.indexOf("@") != -1) {
				//if the dictionary has a "@", it's a nested dictionary.
				//dic1@dic2 means "the dic2 dictionary located in the current row of the dic1 dictionary.
				
				//location of first @
				var firstAt = dataValue.indexOf("@");
				
				//path to dictionary, IE dic1@dic2@dic3.dic4
				//we will remove dictionaries from this path, once at a time, and locate their appropriate instance in the dictionary stack
				var path = dataValue;
				
				//dictionaries removed from the path will be appended here
				var dictionaryNamePrefix = "";
				
				while (firstAt != -1) {
					//get the first dictionary name
					var dictName =  path.substring(0, firstAt);
					
					//remove it from the path
					path = path.substring(firstAt+1, path.length);
					
					//get the dictionary
					var dictionaryIndex = this.dictStack.getDictionaryIndexByName(dictionaryNamePrefix+dictName);
					if (dictionaryIndex!=-1) {
						//get the current row we are in for this dictionary
						var currentRow = this.dictStack.getDictionaryByIndex(dictionaryIndex).currentRow;
						
						//turn the "@" notation to javascript notation
						dataValue = dataValue.replace("@", "["+currentRow+"].");
						
						//update variables for next iteration
						dictionaryNamePrefix += dictName+"@";
						firstAt = path.indexOf("@");
					}
					else {
						printDebug("dictionary with name '"+dictionaryNamePrefix+dictName+"' is not defined.");
					}
				}
				
			}
			
			//will become false if dataValue can't be eval()ed. If so, we try looking for the data once
			//again as a dictionary value.

			data = this.execFunc(dataValue,window);
			var dataExists = data!==undefined && data!==null;
			
			if (!dataExists){
				if (this.dictStack.peek()){
					data = this.dictStack.getDefinition(this.dictStack.peek().currentRow, dataName, -1);
//					if (typeof data == "object") {
//						//success! we found the data!
//					}
				}
			}
			
		} else if (inlineVarRegExp.test(dataValue)) { 
			// handle inline variable instantiation (e.g. "animals=['dog', 'cat']")
			
			var m=inlineVarRegExp.exec(dataValue);
			dataName = m[1]; //get the var name
			dataValue = m[2]; // get the var inline contents
			if (httpVarRegExp.test(dataValue)) { // handle remote http content (e.g. "http://example.com/animals.json")
				m = httpVarRegExp.exec(dataValue);
				var url = m[1];
				var flagDone = false;
				var ajaxData = {
					"url" : url,
					"async" : false,
					"dataType" : "json",
					"complete" : function() {flagDone=true;},
					"success" : function(d) {data=d;}
					};
				$.ajax(ajaxData);
				while (!flagDone) {
					//NOOP to ensure sync
				};
			} else { // expect a json string.
				var fixedJson = m[2].replace(/[']([\s\w]*)[']/g,"\"$1\""); //turn single quotes to double quotes
				data = $.parseJSON(fixedJson);
			}
		} else if (dataValue.match(/^\s*.*\([^\)]*\)\s*$/)) {
			//maybe a function
			var dataFunc = this.execFunc(dataValue,window);
			if (typeof dataFunc == "object") {
				data = dataFunc;
			}
			else {
				printDebug(dataValue+" function didn't return an object for use as a dictionary");
			}
		}
		
		//if we got here and still data is not defined - try this fallback
		if (data===undefined) {
			try{
				data=this.execFunc(dataValue,window);
			} catch(e) {
				//fallback to any JS expression that may be evaluated
				printDebug("Can't figure out what to to with data element "+dataValue);
			}
		}
		
		var alias;
		var enumVar;
		
		try { //IE problem with first method, fallback in catch clause
			alias = $(node).attr("jcc\:alias");
			enumVar = $(node).attr("jcc\:enumerate");
		} catch (e) {
			alias = this.getJccNodeAttribute(node, "alias");
			enumVar = this.getJccNodeAttribute(node, "enumerate");
		}
		
		this.dictStack.push(data, dataName, node, alias, enumVar);
	},

	/*
	 * Handles "jcc:repeat":
	 * Clones the node for each dictionary entry 
	 */
	handleRepeat: function (node, dataValue) {
		var elem = $(node);

		var newNode;
		var me=this;
		var filterFunc=jccIndexFilterFactory(dataValue);

		if (typeof this.dictStack.dictionary == "object") {
			$.each(this.dictStack.dictionary, function(dicIndex, dicValue) {
	
				//check if index is in the filter
				if (!filterFunc(dicIndex, dicValue)) {
					return;
				}
				newNode = elem.clone();
				me.dictStack.peek().currentRow = dicIndex;
				newNode.insertBefore(elem);

				newNode.removeAttr("jcc:repeat");
				me.recurse.apply(me,[newNode.get(0)]);
				me.replaceLiterals.apply(me, [newNode]);
				

			});
		} else {
			printDebug("dictionary with name '"+this.dictStack.dictionaryName+"' is not defined.");
		}
		
		//remove original element, we only want the cloned ones.
		elem.remove();
	},
	
	
	/*
	 * Handles "jcc:tempid" tags.
	 * Makes sure no two elements have the same DOM ID, even if we "jcc:repeat" an element containing
	 * IDs.
	 * Assumption: Before recursing the top JCC element, all "id" attributes were replaced with 
	 * "jcc:tempid" attributes.
	 * This function now takes the "jcc:tempid" and assigns it as the node id according to the 
	 * following rule:
	 * - If only one element is supposed to get this id (I.E it is not "jcc:repeat"ed), the final
	 *   element id is the original element id.
	 * - If more than one element is supposed to get this id (due to "jcc:repeat"), the id given is
	 *   the original id with a suffix "_N", where N is a unique counter for the original id.
	 *   N is 1-based.     
	 */
	handleTempID: function (node, dataValue) {
		idCount = this.tempIdMapping[dataValue];
		if (typeof idCount != "undefined") {
			if (idCount == 1) {
				$("#"+dataValue).attr("id", dataValue+"_1");
			}
			dataValue =  dataValue+"_"+(++this.tempIdMapping[dataValue]);
		}
		else {
			this.tempIdMapping[dataValue] = 1;
		}
		$(node).attr("id", dataValue);
		$(node).removeAttr("jcc:tempid");
	},
	
	/*
	 * Handle "jcc:runonce" code;
	 */
	handleRunOnce: function(node, dataValue) {
		if (dataValue) {
			this.execFunc(dataValue,window);
		}
	},

	/*
	 * Handle "jcc:timeout" code;
	 */
	handleTimeout: function(node, dataValue) {
		if (dataValue) {
				jl=this;
				var refreshNode=function() {
					jl.refresh(node);
				};
				node.jccTimeout = window.setTimeout(refreshNode, dataValue);
		}
	},
	
	/*
	 * Empty handler.
	 */
	handleNothing: function (node) {
		//empty
	},


	/*
	 * Handle jcc:table widget.
	 */
	handleWidgetTable:function(node) {
//		var elem = $(node);
//		var newNode;
//		var me=this;
		
		var dataSource = this.getJccNodeAttribute(node, "data"); //data source for table
		var nodeId = this.getJccNodeAttribute(node, "id"); //id to pass to new table
		var nodeClass = this.getJccNodeAttribute(node, "class"); //classes to pass to new table
		var callBack = this.getJccNodeAttribute(node, "callback"); //callback function
		var repeatFilter = this.getJccNodeAttribute(node, "filter"); //table columns filter
		var tableHead = this.getJccNodeAttribute(node, "tablehead"); //the table head
		
		
		var filterFunc = null;
		if (repeatFilter) {
			//if a filter was supplied, create a new filterFunction.
			filterFunc = new jccIndexFilterFactory(repeatFilter);
		}
		
		if (dataSource) {
			//if data was supplied.
			
			//eval the data, in order to determine the number of columns.
			var data = (new Function("return "+dataSource)).call(window);
			var columnCount = 0;
			if (data.length > 0 && data[0].length > 0) {
				columnCount = data[0].length;
			}
			
			//the result node html 
			var str = "";
			str += "\n<table class=\"jcc";
			if (nodeClass) {
				str += " " + nodeClass;
			}
			str += "\""; //close class
			str += "jcc:data=\"" + dataSource + "\" "; 
			if (nodeId) {
				str += "id=\"" + nodeId +"\" ";
			}
			if (callBack) {
				str += "jcc:callback=\"" + callBack + "\" ";
			}
			
			str += "border=\"1\">\n";

			if (tableHead){
				tableHead = (new Function("return "+tableHead)).call(window);
				if (typeof tableHead == "object") {
					//print the table headers
					str += "\t<thead>\n\t\t<tr";
					if (nodeId) {
						str += " id=\"" + nodeId +"_h_tr\" ";
					}
					str +=">\n";
					
					for(var i=0; i<columnCount ;i++) {	
						if (filterFunc==null || filterFunc(i)) {
							//print this column only if the filter permits it, or wasn't defined at all
							str+="\t\t\t<th";
							if (nodeId) {
								str += " id=\"" + nodeId +"_th\" ";
							}
							str+= ">"+(tableHead[i] ? tableHead[i] : "" )+"</th>\n";
						}
						
					}
					
					str += "\n\t\t</tr>\n\t</thead>\n";
				}
			}
			
			//content
			str+="\t<tbody>\n\t\t<tr jcc:repeat=\"repeat\"";
			if (nodeId) {
				str += " id=\"" + nodeId +"_b_tr\" ";
			}
			str +=	">\n";
			for(var i=0; i<columnCount ;i++) {	
				if (filterFunc==null || filterFunc(i)) {
					//print this column only if the filter permits it, or wasn't defined at all
					str+="\t\t\t<td";
					if (nodeId) {
						str += " id=\"" + nodeId +"_td\" ";
					}
					str+= ">#{"+i+"}</td>\n";
				}
				
			}
			str+="\t\t</tr>\n\t</tbody>\n</table>";
			
			return str;
		}
		
	},
	
	/*
	 * Handle jcc:form widget.
	 */
	handleWidgetForm:function(node) {
//		var elem = $(node);
//		var newNode;
//		var me=this;
		
		var struct = this.getJccNodeAttribute(node, "struct"); //form structure for table
		var nodeId = this.getJccNodeAttribute(node, "id"); //id to pass to new table
		var nodeClass = this.getJccNodeAttribute(node, "class"); //classes to pass to new table
		var callBack = this.getJccNodeAttribute(node, "callback"); //callback function
		
		var iterateAttributes = function(attributesObj){
			str = "";
			if (attributesObj) {
				$.each(attributesObj, function (attribute, value) {
					str += attribute+"=\"" + value +"\" ";
				});
			}	
			return str;
		};
		
		if (struct) {
			//if structure was supplied.
			
			//eval the struct, in order to find out what the form structure is.
			struct = (new Function("return "+struct)).call(window);

			if (typeof struct == "object") {
				//the result node html 
				var str = "";
				str += "\n<form class=\"jcc";
				if (nodeClass) {
					str += " " + nodeClass;
				}
				str += "\""; //close class
	
				if (nodeId) {
					str += "id=\"" + nodeId +"\" ";
				}
				
				if (struct.action) {
					str += "action=\"" + struct.action + "\" ";
				}
				
				if (struct.method) {
					str += "method=\"" + struct.method + "\" ";
				}
				
				if (callBack) {
					str += "jcc:callback=\"" + callBack + "\" ";
				}
				
				str += ">\n";
				str += "<fieldset>";
				
				if (struct.legend) {
					str+= "<legend>"+struct.legend+"</legend>";
				}
				
				str += "<ol>";
				
				//fields
				if (typeof struct.fields == "object") {
					var curField;
					for(var i=0; i<struct.fields.length ;i++) {	
						curField = struct.fields[i];
						var elementType = curField.element || "input";
						str += "<li><label>"+curField.text+"</label>";
						str += "<"+elementType+" ";

						str += iterateAttributes(curField.attributes);
						str += " /></li>\n";
					}
				}
				
				str += "</ol>";
				
				str += "<input type=\"submit\" ";
				if (struct.submit) {
					str += iterateAttributes(struct.submit);
				}
				str += "/>";
				
				str += "</fieldset>";
				str += "</form>";
				
				
				return $(str);
			}
		}
		
	}
	
};



window["jccLib"]=new jcc();

$(document).ready(function() {
    jccLib.init();
});

