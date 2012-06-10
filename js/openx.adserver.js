	/**
	 *
	 * Openx adLoader object for openx
	 * 
	 * Load and check for timeout of the openx Single Page Call.
	 * Banner loading on completion of all scripts loaded.
	 * Handles HTML and JS/Flash Banners
	 * 
	 * @author: Willem Daems
	 * @version: 1.0
	 * @todo: merge onready/oncomplete functions
	 * @todo cleanup  and improve proxyWrite script
	 * 
	 * Copyright 2011(C) Willem Daems.
	 * This program is free software: you can redistribute it and/or modify
	 * it under the terms of the GNU General Public License as published by
	 * the Free Software Foundation, either version 3 of the License, or
	 * (at your option) any later version.

	 * This program is distributed in the hope that it will be useful,
	 * but WITHOUT ANY WARRANTY; without even the implied warranty of
	 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	 * GNU General Public License for more details.

	 * You should have received a copy of the GNU General Public License
	 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
	 * 
	 * 
	 * The general idea:
	 * 
	 * This is script is intended to stop locking up your website when an ad server is not reachable.
	 * The first step is to start the ad loading with the onload of the body. Next overload
	 * the document.write with our own function so we have control over the process.
	 * Then process everything in batches: don't start a batch if another batch isn't loaded fully yet.
	 * Finally: show the banners and release the document.write function
	 * 
	 */
	
	/**
	 * script loader object
	 */
	
	function loader(config)
	{
		this.config = config;
		this.config.timeout = 1000;
		this.loaded = false;
		this.scriptBlock = false;
		
		this.load = function()
		{
			openx.writeActivity = true;
			this.scriptBlock = document.createElement('SCRIPT');
			this.scriptBlock.src = this.config.url.replace(/\&amp;/gi, '&');
			this.scriptBlock.type = 'text/javascript';
			this.scriptBlock._super = this;
			
			this.timer = setTimeout(function(_this) {
				window.stop();
				openx.writeDebug('SCRIPT TIME OUT: ' + _this.config.url);
			}, this.config.timeout, this);
			
			if (!document.getElementsByTagName('HEAD')[0])
			{
				openx.writeDebug('HEAD TAG NOT FOUND');
				return false;
			} else {
				document.getElementsByTagName('HEAD')[0].appendChild(this.scriptBlock);
			}
			
			if (this.scriptBlock.readyState)
			{
				this.scriptBlock._this = this;
				this.scriptBlock.onreadystatechange = function()
				{
					if (this._this.scriptBlock.readyState == 'complete' || this._this.scriptBlock.readyState == 'loaded')
					{
						this._this.callback(this._this);
					}
				}
			} else {
				this.scriptBlock.onload = this.callback(this.scriptBlock._super);
			}
			
			return true;
		}
		
		this.callback = function(_this)
		{
			openx.writeDebug('SCRIPT LOAD SUCCESS ' + _this.config.url);
			clearTimeout(_this.timer);
			openx.writeActivity = false;
		}
	}
	

	/**
	 * The parser object
	 *
	 */
	
	function parser(content)
	{
		this.content = content;
		openx.writeActivity = true;

		this.parse = function()
		{
			var fragment = document.createDocumentFragment();
			var div = document.createElement('DIV');
			div.innerHTML = '&nbsp;';
			div.innerHTML += content;
			fragment.appendChild(div);
			
			openx.writeDebug('fragment: ' + div.getElementsByTagName('SCRIPT').length);
			openx.writeDebug('content: ' + content);
			
			
			// get all the html content
			//if (content.match(/google_ad/,'gi') == null)
			//{
				for (var e = 0; e < div.childNodes.length; e++)
				{
					
					if (!div.childNodes[e].tagName) continue;
					if(div.childNodes[e].getElementsByTagName('SCRIPT').length > 0) continue;
					if (div.childNodes[e].tagName == 'SCRIPT') continue;
					if (openx.zoneName == '') continue;
					
					document.getElementById(openx.zoneName).appendChild(div.childNodes[e]);
				}
			//}
			


			// get all script content
			for (var i = 0; i < div.getElementsByTagName('SCRIPT').length; i++)
			{
				openx.writeDebug('script');
				var script = div.getElementsByTagName('SCRIPT')[i];
				if (script.src != '')
				{
					var spc = new loader({
						url: script.src,
						timeout: 500
					});
					
					spc.load();
				} else {
					
					var eval_script = document.createElement('script');
					if (navigator.appName.match(/internet explorer/gi) != null)
					{
						eval_script.text = script.innerHTML;
					} else {
						eval_script.appendChild( document.createTextNode(script.innerHTML) );
					}
					
					document.getElementById(openx.zoneName).appendChild(eval_script);
					openx.writeDebug(eval_script.innerHTML);
					try {
						eval(eval_script.innerHTML);
					} catch (e) {
						openx.writeDebug('error: ' + e)
					}	
				}
			}
			
			openx.writeActivity = false;
		}
	}
	
	/**
	 * openx utility class
	 */

	var openx =
	{
		zoneIndex: 0,
		zoneName: '',
		writeActivity: false,
		watchCycles: 0,
		watch: false,
		orgWrite: document.write,
		debug: true,
		init: function(options)
		{
			document.write = openx.write;
			OA_arr = Array();
			for (var i in OA_zones)
			{
				openx.writeDebug('found: ' + i);
				OA_arr.push(i);
			}
			
			var spc = new loader({
				url: options.url,
				timeout: 500
			});
			
			spc.load();
			this.setWatch();
			
		},
		write: function(content)
		{
			var p = new parser(content);
			p.parse();
		},
		setWatch: function()
		{
			this.watchCycles = 0;
			
			var _this = this;
			this.watch = setInterval(function() {
				if (_this.writeActivity == false) _this.watchCycles++;
				if (_this.watchCycles == 5)
				{
					clearTimeout(_this.watch);
					openx.writeDebug('done watching');
					openx.loadOA();
					_this.zoneIndex++;
				}
			}, 100, this);
		},
		loadOA: function()
		{
			if (OA_arr[this.zoneIndex])
			{
				this.zoneName = OA_arr[this.zoneIndex];
				this.setWatch();
				openx.writeDebug('ZONE: ' + OA_arr[this.zoneIndex]);
				OA_show(OA_arr[this.zoneIndex]);
			} else {
				openx.writeDebug('COMPLETED');
			}			
		},
		writeDebug: function(line)
		{
			if (!this.debug) return;
			if (typeof console != 'undefined')
			{
				console.log(line);
			}
		}
	}