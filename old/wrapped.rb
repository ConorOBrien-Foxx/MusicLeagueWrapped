# stats per person
# - total upvotes
# - total downvotes
# - net score
# - biggest critics (3) - people who gave you the most downvotes
# - biggest fans (3) - people who gave you the most upvotes
# - best songs (3) - songs with highest net score
# - worst songs (3) - songs with lowest net score
# - total characters typed
# - top artists submitted (3) - artist names you've submitted the most frequently

# overall stats
# - most upvoted songs (top 3)
# - most downvoted songs (top 3)
# - person with most upvotes (top 3)
# - person with most downvotes (top 3)

require 'json'
$base = "season-3"
data = JSON::load_file "#{$base}.json"
users = {}
User = Struct.new(:name, :img, :upvotes, :downvotes, :songs, :fans, :critics, :rank) {
    def initialize(name, img)
        super(
            name, img,
            0, 0,
            [],
            Hash.new(0), Hash.new(0),
            nil,
        )
    end
    
    def net_score
        upvotes + downvotes
    end
    
    def to_s
        [
            "User #{name}",
            "Net score #{net_score}",
            "Upvotes received #{upvotes}",
            "Downvotes received #{downvotes}",
        ].join "\n"
    end
    
    def to_json(*args)
        {
            name: name,
            img: img,
            rank: rank,
            net_score: net_score,
            upvotes: upvotes,
            downvotes: downvotes,
            critics: critics.sort_by { |key, score| score }.to_h,
            fans: fans.sort_by { |key, score| -score }.to_h,
            best_songs: songs.sort_by { |info| -info["votes"] },
            worst_songs: songs.sort_by { |info| info["votes"] },
        }.to_json(*args)
    end
}

data.each { |round_number, round|
    # p round_number
    round["info"].each { |song|
        user = song["submitter"]
        img = song["submitterImg"]
        user_info = (users[user] ||= User.new user, img)
        # puts "#{user} #{song["songName"]}"
        net_votes = 0
        song["responses"].each { |response|
            votes = response["votes"].to_i
            respondant = response["name"]
            net_votes += votes
            if votes < 0
                user_info.critics[respondant] += votes
                user_info.downvotes += votes
            elsif votes > 0
                user_info.fans[respondant] += votes
                user_info.upvotes += votes
            else
                # users who voted +0
            end
        }
        user_info.songs << {
            "name" => song["songName"],
            "votes" => net_votes,
            "round" => round_number,
            "img" => song["album"]["cover"]
        }
    }
}

def get_places(list, &cmp)
    cmp ||= -> a { a }
    indices = list
        .map
        .with_index
        .group_by { |a,i| cmp[a] }
        .sort_by { |key, val| key }
        .inject([]) { |build, (cmp_key, members)|
            last_rank = (build.last || [1]).first
            last_count = (build.last || [[]]).last.size
            [*build, [last_rank + last_count, members.map(&:last)]]
        }
    result = []
    indices.each { |rank, members| members.each { |idx| result[idx] = rank } }
    result
end

places = get_places(users.values) { |user| -user.net_score }

users.each.with_index { |(user, data), i|
    # make sure we have +0 for critics/fans
    users.each { |their_user, their_data|
        next if user == their_user
        their_data.critics[user] += 0
        their_data.fans[user] += 0
    }
    # give our user their rank
    data.rank = places[i]
}


# File.write "#{$base}-wrapped.json", users.to_json

user_list = users
    .sort_by { |username, user| user.name.downcase }
    .map { |username, user|
        "<li><a href=\"#!\" data-value=\"#{user.name}\"><img src=\"#{user.img}\" alt=\"#{user.name}\" class=\"left\">#{user.name}</a></li>"
    }
    .join "\n"

File.write "#{$base}-wrapped.html", <<EOT
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Add Materialize CSS and JavaScript CDN links -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
  <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
  <title>Season 3 Wrapped</title>
  <script>
    window.SeasonWrapped = #{users.to_json}
  </script>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <div class="container">
    <h3>Gaimes Music League Season 3 Wrapped</h3>

    <a class="dropdown-trigger btn" href="#" data-target="user-select"><i>Please select a user&hellip;</i></a>
    
    <ul id="user-select" class="dropdown-content">
      #{user_list}
    </ul>
    
    <div>
        <h4 id="selected-user"><i>Selected user will show here</i></h4>
        <div id="user-info"></div>
    </div>
  </div>

  <script src="wrapped.js"></script>

</body>
</html>

EOT