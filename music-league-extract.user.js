// ==UserScript==
// @name         MusicLeagueDataExtractor
// @namespace    http://tampermonkey.net/
// @version      2023-12-23
// @description  A tool to help extract music league data
// @author       Conor O'Brien
// @match        https://app.musicleague.com/l/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=musicleague.com
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/ConorOBrien-Foxx/MusicLeagueWrapped/main/music-league-extract.user.js
// @updateURL    https://raw.githubusercontent.com/ConorOBrien-Foxx/MusicLeagueWrapped/main/music-league-extract.user.js
// ==/UserScript==

(function() {
    "use strict";

    const promiseQuerySelector = (query, base=document, maxCount=300) => new Promise((resolve, reject) => {
        const test = count => {
            if(count >= maxCount) {
                return reject(`Exceeded maxCount ${maxCount} tries`);
            }
            let result = base.querySelector(query);
            // console.log(count, result);
            if(!result) {
                setTimeout(test, 100, count + 1);
            }
            else {
                resolve(result);
            }
        };
        
        test(0);
    });
    
    window.MusicLeagueExtractor = {
        AppInfo: {},
        extractSongInfo(baseEl) {
            let [
                albumInfo,
                submitter,
                ...responses
            ] = baseEl.children;
            let [ submitterImg, submitterName ] = submitter.children;
            submitterImg = submitterImg.firstElementChild.src;
            submitterName = submitterName.textContent.match(/Submitted by (.+)\s+$/)[1];

            let [ albumCover, otherInfo ] = albumInfo.children;
            albumCover = albumCover.firstElementChild.src;
            let [ songName, artistName, albumName ] = otherInfo.querySelector(".col").children;

            let submitterComments = "";
            if(responses[0].tagName === "SPAN") {
                submitterComments = responses.shift().textContent;
            }

            responses = responses.map(response => {
                response = response.firstElementChild;
                let [ hr, userVoteCombo, comment ] = response.children;
                let [ userImg, userName, votes ] = userVoteCombo.children;
                userImg = userImg.firstElementChild.src;
                userName = userName.textContent;
                votes = votes.textContent;
                comment = comment?.textContent ?? null;
                return {
                    img: userImg,
                    name: userName,
                    votes,
                    comment
                };
            });

            this.AppInfo[this.league].members[submitterName] = submitterImg;
            return {
                album: {
                    cover: albumCover,
                    name: albumName.textContent,
                },
                artist: artistName.textContent,
                songName: songName.textContent,
                comments: submitterComments,
                submitter: submitterName,
                // submitterImg,
                responses
            };
        },
        getAllSongInfos() {
            return [...
                    document.querySelector(".leagueHeader + div > div")
                    .children
                   ].slice(1);
        },
        pageData() {
            let info = this.getAllSongInfos();
            let data = info.map(itemInfo => this.extractSongInfo(itemInfo));
            return data;
        },
        extractRoundInfo() {
            let roundInfo = document.querySelector(".leagueHeader + div > div > div");
            let [ roundNumber, roundName, roundDescription ] = roundInfo.children;
            roundNumber = roundNumber.textContent.match(/\d+/)[0];
            roundName = roundName.textContent;
            roundDescription = roundDescription?.textContent ?? null;
            return {
                name: roundName,
                number: roundNumber,
                description: roundDescription,
                info: this.pageData(),
            };
        },
        loadLocalInfo() {
            localStorage.musicLeague ??= "{}";
            this.AppInfo = JSON.parse(localStorage.musicLeague);
        },
        saveLocalInfo() {
            localStorage.musicLeague = JSON.stringify(this.AppInfo);
        },
        
        async addButtons() {
            if(!this.league) {
                alert("Could not load");
                return;
            }
            
            this.loadLocalInfo();
            
            // evil hack
            const headerEl = await promiseQuerySelector(".leagueHeader > div > div > div + div + div > div + div + div > div");
            if(!this.round) {
                // just a league page
                const startSaving = document.createElement("button");
                const clearInfo = document.createElement("button");
                this.downloadInfo = document.createElement("button");
                
                if(this.AppInfo[this.league]) {
                    startSaving.textContent = "Reset Saving";
                }
                else {
                    startSaving.textContent = "Start Saving";
                }
                startSaving.addEventListener("click", () => {
                    this.AppInfo[this.league] = {
                        id: this.league,
                        name: headerEl.firstChild.textContent,
                        members: {},
                        rounds: {},
                    };
                    this.saveLocalInfo();
                    startSaving.textContent = "Reset Saving";
                    MusicLeagueExtractor.addMarkers();
                });
                clearInfo.textContent = "Clear League Info";
                clearInfo.addEventListener("click", () => {
                    delete this.AppInfo[this.league];
                    this.saveLocalInfo();
                    this.addMarkers();
                    startSaving.textContent = "Start Saving";
                    MusicLeagueExtractor.addMarkers();
                });
                this.downloadInfo.textContent = "Download League Info (?/?)";
                this.downloadInfo.addEventListener("click", () => {
                    this.loadLocalInfo();
                    const jsonString = JSON.stringify(this.AppInfo[this.league], null, 2);
                    const blob = new Blob([jsonString], { type: "application/json" });
                    const link = document.createElement("a");
                    link.download = this.AppInfo[this.league].name.replace(/[^a-z0-9._-]+/gi, "_") + ".json";
                    link.href = URL.createObjectURL(blob);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                });
                headerEl.appendChild(startSaving);
                headerEl.appendChild(clearInfo);
                headerEl.appendChild(this.downloadInfo);
            }
            else {
                // sub-league page
                const saveButton = document.createElement("button");
                if(this.AppInfo[this.league]) {
                    if(this.AppInfo[this.league].rounds[this.round]) {
                        saveButton.textContent = "Save round (already saved)";
                    }
                    else {
                        saveButton.textContent = "Save round";
                    }
                    saveButton.addEventListener("click", () => {
                        let saveInfo = this.extractRoundInfo();
                        this.AppInfo[this.league].rounds[this.round] = saveInfo;
                        this.saveLocalInfo();
                        saveButton.textContent = "Save round (already saved)";
                    });
                }
                else {
                    saveButton.textContent = "(No save started yet)";
                    saveButton.disabled = true;
                }
                headerEl.appendChild(saveButton);
            }
            MusicLeagueExtractor.addMarkers();
        },
        
        addMarkers() {
            this.loadLocalInfo();
            let roundIds;
            if(this.AppInfo?.[this.league]?.rounds) {
                roundIds = Object.keys(this.AppInfo[this.league].rounds);
                for(let id of roundIds) {
                    let el = document.getElementById(id);
                    if(!el || el.classList.contains("extract-saved")) {
                        continue;
                    }
                    el.classList.add("extract-saved");
                }
            }
            else {
                for(let remove of document.querySelectorAll(".extract-saved")) {
                    remove.classList.remove("extract-saved");
                }
            }
            if(this.downloadInfo) {
                // evil hack
                let existingInfo = [...document.querySelectorAll(".container")[2]
                    .firstElementChild
                    .firstElementChild
                    .firstElementChild
                    .children
                ].slice(1);
                this.downloadInfo.textContent = `Download League Info (${roundIds?.length ?? "XXX"}/${existingInfo.length})`;
            };
        },
    };
    
    
    const myStyle = `
        .extract-saved {
            background-color: rgb(200, 255, 200) !important;
        }
        .extract-saved h5:after {
            content: " (saved!)";
        }
    `;
    const myStyleEl = document.createElement("style");
    myStyleEl.innerHTML = myStyle;
    document.head.appendChild(myStyleEl);
    
    let isLoaded = false;
    const onLoad = () => {
        if(isLoaded) {
            return;
        }
        isLoaded = true;
        console.log("[music league extract] Page loaded...");
        const [ , league, round ] = window
            .location
            .toString()
            .match(/l\/(.+?)(?:\/(?:(.+?)(?:\/|$))?|$)/);
        MusicLeagueExtractor.league = league;
        MusicLeagueExtractor.round = round;
        MusicLeagueExtractor.addButtons();
        document.addEventListener("focus", () => {
            MusicLeagueExtractor.addMarkers();
        });
    };

    window.addEventListener("load", onLoad);
    if(document.readyState === "complete") {
        onLoad();
    }
})();
