const sanitize = require('sanitize-filename');
const $ = require('jquery');

const subforumIndex = require(`./indexes/subforumIndex.json`);
const threadIndex = require('./indexes/threadIndex.json');
const postIndex = require('./indexes/postIndex.json');
const imageIndex = require('./indexes/imageIndex.json');
const PATH_HEADER = '.\\bmgArchive\\';

function prependPath(path) {
    return `${PATH_HEADER}${path}`
}

function getUserAvatarLocationByID(id) {
    let path = imageIndex.userAvatarIndex[id];
    if (path) {
        return prependPath(path)
    } else {
        return ".\\imageMissing.png";
    }
}

function getUserAvatarLocationByName(name) {
    let santizedName = sanitize(name).replace(' ', '_');
    for (let id in imageIndex.userAvatarIndex) {
        let path = imageIndex.userAvatarIndex[id];
        if (path.includes(santizedName)) {
            return prependPath(path);
        }
    }

    return '.\\imageMissing.png';
}

function getBBImageLocationByHash(hash) {
    let path = imageIndex.bbImageIndex[hash];
    if (path) {
        return prependPath(path)
    } else {
        return ".\\imageMissing.png";
    }
}

function getThreadPath(threadID, pageNum) {
    let entry = threadIndex[threadID];
    if (entry) {
        return prependPath(`${entry.path}\\page-${pageNum}.html`);
    } else {
        throw `No such thread for threadID ${threadID}`; 
    }
}

function getSubforumPath(subforumID, pageNum) {
    let entry = subforumIndex[subforumID];
    if (entry) {
        return prependPath(`${entry.path}\\page-${pageNum}.html`);
    } else {
        throw `No such subforum for subforumID ${subforumID}`;
    }
}

function $getXHRThreadPageByID(threadID, pageNum) {
    return $.get(getThreadPath(threadID, pageNum)).then(processHTML);
}

function $getXHRSubforumByID(subforumID, pageNum) {
    return $.get(getSubforumPath(subforumID, pageNum)).then(processHTML);
}

function processHTML(data) {
    let $body = $($.parseHTML(data)).find('.p-body');
            
    //It's time for clean up!
    //Remove crap that's cluttering or just doesn't work.
    $body.find('noscript').remove();
    $body.find('.notices').remove();
    $body.find('.shareButtons').remove();
    $body.find('i[class^=fa]').remove();
    $body.find('li').has('a[data-xf-init="share-tooltip"').remove();
    $body.find('div.block-outer-opposite').remove();
    $body.find('img[src^="\/styles"]').remove();
    $body.find('form.js-quickReply').remove();

    //Fix links
    $body.find('a').each((i, e) => {
        let $a = $(e);
        let href = $a.attr('href');
        //We only care about internal links
        if (href && (href.match(/^\/index\.php\??|^https:\/\/forums\.bulba/))) {

            //Keep these ones
            let match;
            if (href.match(/\?threads\/.+?\.\d+\/|post-\d+$/)) {
                $a.attr('href', href.replace(/.+?index.php\?/, "#!/"));
            } else if ((match = href.match(/post&id=(\d+)/)) != null) {
                //console.log(match);
                $a.attr('href', `#!/post/${match[1]}`);
            } else if ((match = href.match(/\?forums\/.+?\.(\d+)\//)) != null) {
                //Save forum links... but only to the ones that we actually downloaded (didn't download those that had no threads!)
                if (subforumIndex[match[1]]) {
                    $a.attr('href', href.replace(/.+?index.php\?/, "#!/"));
                } else {
                    $a.removeAttr('href');
                }
            } else {
                //Yeet these ones out
                $a.removeAttr('href');
            }
        }
    })

    //Fix user avatars
    $body.find('img[class^="avatar"').each((i, e) => {
        $img = $(e);
        let userID = $img.parent().attr('data-user-id');
        $img.attr('src', getUserAvatarLocationByID(userID));
    });

    //Fix images
    let $images = $body.find('img.bbImage');
    if ($images.length > 0) {
        $images.each((i, e) => {
            $img = $(e);
            let srcUrl = $img.attr('src');
            
            if (srcUrl == null) {
                return;
            }

            //Bad url filtering
            if (srcUrl.match(/file:\/\/\/C/)) {
                return;
            }
            
            //console.log(srcUrl);
            let hashCaptures = srcUrl.match(/hash=(?<hash1>.+)$|attachments\/\d+\/(?<hash2>[^\.]+)\.|attachments\/(?<hash3>[^\/]+)/);
            if (hashCaptures == null) {
                console.log(`Unknown url format, cannot extract hash: ${srcUrl}`);
                $img.attr('.\\imageMissing.png');
            }
            
            let hash;
            if (hashCaptures.groups.hash1 !== undefined) {
                hash = hashCaptures.groups.hash1;
            } else if (hashCaptures.groups.hash2 !== undefined) {
                hash = hashCaptures.groups.hash2;
            } else if (hashCaptures.groups.hash3 !== undefined) {
                hash = hashCaptures.groups.hash3;
            }

            $img.attr('src', getBBImageLocationByHash(hash));
        });
    }

    return $body;
}

function getPostInfoByID(postID) {
    return postIndex[postID];
}

module.exports = {
    prependPath,
    getUserAvatarLocationByID,
    getUserAvatarLocationByName,
    getBBImageLocationByHash,
    getThreadPath,
    $getXHRThreadPageByID,
    $getXHRSubforumByID,
    getPostInfoByID
}