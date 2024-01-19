const scoreToString = score =>
    (score >= 0 ? "+" : "") + score;

const getPlaces = (list, cmp=(a => a)) => {
    let grouped = new Map();
    list.forEach((element, index) => {
        let key = cmp(element);
        let val = grouped.get(key) ?? [];
        val.push({ element, index });
        grouped.set(key, val);
    });
    grouped = [...grouped];
    grouped.sort(([k1, v1], [k2, v2]) =>
        k1 < k2 ? 1 : k1 > k2 ? -1 : 0
    );
    let indices = grouped.reduce((build, [compare, members]) => {
        let lastRank = (build.at(-1) ?? [1])[0];
        let lastCount = (build.at(-1) ?? [[]]).at(-1).length;
        return [
            ...build,
            [
                lastRank + lastCount,
                members.map(member => member.index),
            ],
        ];
    }, []);
    let result = [];
    for(let [ rank, members ] of indices) {
        for(let idx of members) {
            result[idx] = rank;
        }
    }
    return result;
};

const compareCaseInsensitive = (a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })

const App = {
    setData(data) {
        this.data = data;
        this.processData();
        
        let userNames = Object.keys(this.data.members)
            .sort(compareCaseInsensitive);
        $("#user-select").empty();
        for(let name of userNames) {
            let a = $(`<a href="#!"></a>`);
            a.attr("data-value", name);
            let img = $(`<img class="left">`);
            img.attr("src", this.data.members[name]);
            img.attr("alt", name);
            a.append(img);
            a.append(name);
            let li = $("<li>");
            li.append(a);
            
            a.click(() => {
                App.loadData(a.attr("data-value"));
            });
            
            $("#user-select").append(li);
        }
        $("#app")[0].classList.toggle("hidden", !this.data);
    },
    
    processData() {
        this.stats = {
            users: new Map(),
        };
        for(let round of Object.values(this.data.rounds)) {
            for(let song of round.info) {
                let { submitter } = song;
                let userInfo = this.stats.users.get(submitter) ?? {
                    netScore: 0,
                    critics: {},
                    downvotes: 0,
                    fans: {},
                    upvotes: 0,
                    songs: [],
                };
                let netVotes = 0;
                for(let response of song.responses) {
                    let votes = parseInt(response.votes || "0", 10);
                    let respondant = response.name;
                    netVotes += votes;
                    if(votes < 0) {
                        userInfo.critics[respondant] ??= 0;
                        userInfo.critics[respondant] += votes;
                        userInfo.downvotes += votes;
                    }
                    else if(votes > 0) {
                        userInfo.fans[respondant] ??= 0;
                        userInfo.fans[respondant] += votes;
                        userInfo.upvotes += votes;
                    }
                    else {
                        // users who voted +0
                    }
                    userInfo.netScore += votes;
                }
                userInfo.songs.push({
                    name: song.songName,
                    votes: netVotes,
                    round: round.number,
                    img: song.album.cover
                });
                this.stats.users.set(submitter, userInfo);
            }
        }
        
        let places = getPlaces([...this.stats.users.values()], user => user.netScore);
        [...this.stats.users.entries()].forEach(([user, data], i) => {
            for(let [ theirUser, theirData ] of this.stats.users.entries()) {
                if(user !== theirUser) {
                    theirData.critics[user] ??= 0;
                    theirData.fans[user] ??= 0;
                }
            }
            data.rank = places[i];
        });
        for(let [ user, data] of this.stats.users.entries()) {
            data.bestSongs = [...data.songs].sort((s1, s2) => s2.votes - s1.votes);
            data.worstSongs = [...data.songs].sort((s1, s2) => s1.votes - s2.votes);
            data.critics = Object.entries(data.critics).sort((c1, c2) => c1[1] - c2[1]);
            data.fans = Object.entries(data.fans).sort((c1, c2) => c2[1] - c1[1]);
        }
    },
    
    userPreview(userName) {
        let userImg = this.data.members[userName];
        return $(`<a><img class="smol-icon" src="${userImg}" alt="${userName}">${userName}</a>`);
    },
    songPreview(songData) {
        return $(`<a><img class="smol-icon" src="${songData.img}" alt="${songData.name}">${songData.name}</a>`);
    },
    
    loadData(user) {
        console.log("Loading data for", user);
        let totalUsers = Object.entries(this.data.members).length;
        let userStats = this.stats.users.get(user);
        $("#selected-user")
            .empty()
            .append(this.userPreview(user));
        const critics = userStats.critics
            .map(([name, amount]) => $("<li>")
                .append(this.userPreview(name))
                .append(" " + scoreToString(amount))
            );
        const fans = userStats.fans
            .map(([name, amount]) => $("<li>")
                .append(this.userPreview(name))
                .append(" " + scoreToString(amount))
            );
        const bestSongs = userStats
            .bestSongs
            .slice(0, 5)
            .map(songData => $("<li>")
                .append(this.songPreview(songData))
                .append(" " + scoreToString(songData.votes) + ` (round ${songData.round})`)
            );
        const worstSongs = userStats
            .worstSongs
            .slice(0, 5)
            .map(songData => $("<li>")
                .append(this.songPreview(songData))
                .append(" " + scoreToString(songData.votes) + ` (round ${songData.round})`)
            );
        const newInfo = $(`
            <ul>
                <li style="flex: 0 1 100%;">Final score: ${scoreToString(userStats.netScore)} (${scoreToString(userStats.upvotes)}/${scoreToString(userStats.downvotes)}) &sdot; Placed ${userStats.rank}/${totalUsers}</li>
                <li style="flex: 2 0 40%;">Biggest critics: <ol class=critics></ol></li>
                <li style="flex: 2 0 40%;">Biggest fans: <ol class=fans></ol></li>
                <li style="flex: 2 0 40%;">Best songs: <ol class=bestsongs></ol></li>
                <li style="flex: 2 0 40%;">Worst songs: <ol class=worstsongs></ol></li>
            </ul>
        `);
        newInfo.find(".critics").append(critics);
        newInfo.find(".fans").append(fans);
        newInfo.find(".bestsongs").append(bestSongs);
        newInfo.find(".worstsongs").append(worstSongs);
        $("#user-info")
            .empty()
            .append(newInfo);
    },
    
    leagueAction(action) {
        if(action === "view-all-songs") {
            let allSongs = this.getAllSongs();
            $("#user-info").empty();
            let table = $("<table>");
            table.append("<tr><th>Song name</th><th>Song artist</th><th style=\"min-width: 20ch;\">Submitter(s)</th></tr>");
            let songs = [...allSongs.values()];
            songs.sort((s1, s2) =>
                compareCaseInsensitive(s1.submitters[0], s2.submitters[0])
                || compareCaseInsensitive(s1.artist, s2.artist)
                || compareCaseInsensitive(s1.songName, s2.songName)
            );
            for(let song of songs) {
                let songDisplay = $("<tr>");
                songDisplay.append($("<td>").append(this.songPreview({
                    img: song.album.cover,
                    name: song.songName,
                })));
                songDisplay.append($(`<td>${song.artist}</td>`));
                let submittersCell = $("<td>");
                song.submitters.forEach(submitter => {
                    submittersCell.append(this.userPreview(submitter));
                });
                songDisplay.append(submittersCell);
                table.append(songDisplay);
            }
            $("#user-info").append(table);
            // $("#user-info").text([...allSongs].map(([key, value]) => key));
        }
        else {
            alert(`Unknown action: ${action}`);
        }
    },
    
    getAllSongs() {
        let songMap = new Map();
        for(let round of Object.values(this.data.rounds)) {
            for(let submission of round.info) {
                let key = [ submission.artist, submission.songName, submission.album.name ];
                if(songMap.has(key)) {
                    let info = songMap.get(key);
                    info.submitters.push(submission.submitter);
                }
                else {
                    songMap.set(key, {
                        songName: submission.songName,
                        artist: submission.artist,
                        album: submission.album,
                        submitters: [ submission.submitter ],
                    });
                }
            }
        }
        return songMap;
    },
};


$(document).ready(function(){
    const jsonInput = $("#jsonFileInput");
    const onFileReady = () => {
        let file = jsonInput[0].files[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;

                try {
                    const jsonData = JSON.parse(content);
                    App.setData(jsonData);
                }
                catch (error) {
                    console.error("Error parsing JSON:", error);
                }
            };
            reader.readAsText(file);
        }
    };
    jsonInput.on("change", onFileReady);
    onFileReady();
    
    $(".dropdown-trigger").dropdown();
    
    $("#league-info-select a").click((ev) => {
        App.leagueAction(ev.target.closest("a").dataset.value);
    });
});