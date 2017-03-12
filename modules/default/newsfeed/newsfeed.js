/* global Module */

/* Magic Mirror
 * Module: NewsFeed
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("newsfeed",{

    // Default module config.
    defaults: {
        feeds: [
        {
            title: "New York Times",
            url: "http://www.nytimes.com/services/xml/rss/nyt/HomePage.xml",
            encoding: "UTF-8" //ISO-8859-1
        }
        ],
        showSourceTitle: true,
        showPublishDate: true,
        showDescription: false,
        maxHeadlinesDisplayed: 1,  // how many headlines to display per refresh
        reloadInterval:  5 * 60 * 1000, // every 5 minutes
        updateInterval: 10 * 1000,
        animationSpeed: 2.5 * 1000,
        maxNewsItems: 0, // 0 for unlimited
        removeStartTags: "",
        removeEndTags: "",
        startTags: [],
        endTags: []

    },

    // Define required scripts.
    getScripts: function() {
        return ["moment.js", this.file('vendor/jquery.min.js')];
    },

        // Define required translations.
    getTranslations: function() {
        // The translations for the defaut modules are defined in the core translation files.
        // Therefor we can just return false. Otherwise we should have returned a dictionairy.
        // If you're trying to build yiur own module including translations, check out the documentation.
        return false;
    },

        // Define start sequence.
    start: function() {
        Log.info("Starting module: " + this.name);

        // Set locale.
        moment.locale(config.language);

        this.newsItems = [];
        this.loaded = false;
        this.activeItem = 0;

        this.registerFeeds();

    },

        // Override socket notification handler.
    socketNotificationReceived: function(notification, payload) {
        if (notification === "NEWS_ITEMS") {
            this.generateFeed(payload);

            if (!this.loaded) {
                this.scheduleUpdateInterval();
            }

            this.loaded = true;
        }
    },

        // Override dom generator.
    getDom: function() {
        var wrapper = $("<div>");

        if (this.config.feedUrl) {
            wrapper.addClass("small bright");
            wrapper.html("The configuration options for the newsfeed module have changed."
                    + "<br>Please check the documentation.");
            return wrapper.get(0);
        }

        if (this.activeItem >= this.newsItems.length) {
            this.activeItem = 0;
        }

        /* if we have any news items at all */
        if (this.newsItems.length > 0) {

            for (var i=0; i<this.config.maxHeadlinesDisplayed; i++) {

                if (this.config.showSourceTitle || this.config.showPublishDate) {
                    var sourceAndTimestamp = $("<div>");
                    sourceAndTimestamp.addClass("light small dimmed");
                    var titlehtml = '';

                    if (this.config.showSourceTitle && this.newsItems[this.activeItem+i].sourceTitle !== "") {
                        titlehtml = this.newsItems[this.activeItem+i].sourceTitle;
                    }
                    if (this.config.showSourceTitle && this.newsItems[this.activeItem+i].sourceTitle !== "" && this.config.showPublishDate) {
                        titlehtml += ", ";
                    }
                    if (this.config.showPublishDate) {
                        titlehtml += moment(new Date(this.newsItems[this.activeItem+i].pubdate)).fromNow();
                    }
                    if (this.config.showSourceTitle && this.newsItems[this.activeItem+i].sourceTitle !== "" || this.config.showPublishDate) {
                        titlehtml += ":";
                    }

                    sourceAndTimestamp.html(titlehtml);
                    wrapper.append(sourceAndTimestamp.clone());
                }

                //Remove selected tags from the beginning of rss feed items (title or description)

                if (this.config.removeStartTags == "title" || "both") {

                    for (f=0; f<this.config.startTags.length; f++) {
                        if (this.newsItems[this.activeItem+i].title.slice(0,this.config.startTags[f].length) == this.config.startTags[f]) {
                            this.newsItems[this.activeItem+i].title = this.newsItems[this.activeItem+i].title.slice(this.config.startTags[f].length,this.newsItems[this.activeItem+i].title.length);
                        }
                    }

                }

                if (this.config.removeStartTags == "description" || "both") {

                    if (this.config.showDescription) {
                        for (f=0; f<this.config.startTags.length;f++) {
                            if (this.newsItems[this.activeItem+i].description.slice(0,this.config.startTags[f].length) == this.config.startTags[f]) {
                                this.newsItems[this.activeItem+i].title = this.newsItems[this.activeItem+i].description.slice(this.config.startTags[f].length,this.newsItems[this.activeItem+i].description.length);
                            }
                        }
                    }

                }

                //Remove selected tags from the end of rss feed items (title or description)

                if (this.config.removeEndTags) {
                    for (f=0; f<this.config.endTags.length;f++) {
                        if (this.newsItems[this.activeItem+i].title.slice(-this.config.endTags[f].length)==this.config.endTags[f]) {
                            this.newsItems[this.activeItem+i].title = this.newsItems[this.activeItem+i].title.slice(0,-this.config.endTags[f].length);
                        }
                    }

                    if (this.config.showDescription) {
                        for (f=0; f<this.config.endTags.length;f++) {
                            if (this.newsItems[this.activeItem+i].description.slice(-this.config.endTags[f].length)==this.config.endTags[f]) {
                                this.newsItems[this.activeItem+i].description = this.newsItems[this.activeItem+i].description.slice(0,-this.config.endTags[f].length);
                            }
                        }
                    }

                }

                var title = $("<div>");
                title.addClass("bright medium light");
                title.html(this.newsItems[this.activeItem+i].title);
                wrapper.append(title.clone());

                if (this.config.showDescription) {
                    var description = $("<div>");
                    description.addClass("small light");
                    description.html(this.newsItems[this.activeItem+i].description);
                    wrapper.append(description.clone());
                }
            } /* end for loop for number of headlines */

        } else {
            wrapper.html(this.translate("LOADING"));
            wrapper.addClass("small dimmed");
        }

        return wrapper.get(0);
    },

        /* registerFeeds()
         * registers the feeds to be used by the backend.
         */

    registerFeeds: function() {
        for (var f in this.config.feeds) {
            var feed = this.config.feeds[f];
            this.sendSocketNotification("ADD_FEED", {
                feed: feed,
                config: this.config
            });
        }
    },

        /* registerFeeds()
         * Generate an ordered list of items for this configured module.
         *
         * attribute feeds object - An object with feeds returned by the nod helper.
         */
    generateFeed: function(feeds) {
        var newsItems = [];
        for (var feed in feeds) {
            var feedItems = feeds[feed];
            if (this.subscribedToFeed(feed)) {
                for (var i in feedItems) {
                    var item = feedItems[i];
                    item.sourceTitle = this.titleForFeed(feed);
                    newsItems.push(item);
                }
            }
        }
        newsItems.sort(function(a,b) {
            var dateA = new Date(a.pubdate);
            var dateB = new Date(b.pubdate);
            return dateB - dateA;
        });
        if(this.config.maxNewsItems > 0) {
            newsItems = newsItems.slice(0, this.config.maxNewsItems);
        }
        this.newsItems = newsItems;
    },

        /* subscribedToFeed(feedUrl)
         * Check if this module is configured to show this feed.
         *
         * attribute feedUrl string - Url of the feed to check.
         *
         * returns bool
         */
    subscribedToFeed: function(feedUrl) {
        for (var f in this.config.feeds) {
            var feed = this.config.feeds[f];
            if (feed.url === feedUrl) {
                return true;
            }
        }
        return false;
    },

        /* subscribedToFeed(feedUrl)
         * Returns title for a specific feed Url.
         *
         * attribute feedUrl string - Url of the feed to check.
         *
         * returns string
         */
    titleForFeed: function(feedUrl) {
        for (var f in this.config.feeds) {
            var feed = this.config.feeds[f];
            if (feed.url === feedUrl) {
                return feed.title || "";
            }
        }
        return "";
    },

        /* scheduleUpdateInterval()
         * Schedule visual update.
         */
    scheduleUpdateInterval: function() {
        var self = this;

        self.updateDom(self.config.animationSpeed);

        setInterval(function() {
            self.activeItem += self.config.maxHeadlinesDisplayed;
            self.updateDom(self.config.animationSpeed);
        }, this.config.updateInterval);
    },

        /* capitalizeFirstLetter(string)
         * Capitalizes the first character of a string.
         *
         * argument string string - Input string.
         *
         * return string - Capitalized output string.
         */
    capitalizeFirstLetter: function(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },


});
