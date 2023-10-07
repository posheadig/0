let maze;
let cpuLoad = 0;
let cols, rows;
let w = 20; // Width of the cell
let current; // Current spot
let stack = [];
const ws = new WebSocket('wss://hook.nulladdress.xyz:8080');
let latestPrivateKey = '';
let currentColor;
let targetColor;
let hashDataTimeout;

const HASH_DATA_INTERVAL = 5000; 
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
   // console.log(data);
    if (data.metrics) {
        cpuLoad = data.metrics.cpuLoad;
        console.log(cpuLoad);
    }

    if (data.cycleCount) {
        if (data.cycleCount === 100) {
            frameRate(data.cycleCount / 5);
            targetColor = color(0, 0, 0); 
            console.log(targetColor); // shade of green for 100 tries
        } else if (data.cycleCount === 200) {
            targetColor = color(155, 155, 155);  // orange for 200 tries
        } else if (data.cycleCount === 1000) {
            targetColor = color(255, 230, 250);  // red for 1000 tries
        }
    }
    if (data.success) {
        document.getElementById('result').textContent = 'Success! Found the private key for the zero address: ' + data.privateKey;
    } else if (data.failure) {
        document.getElementById('result').textContent = `Another 1000 attempts made. No success yet.`;
    } else if (data.privateKey && data.address) {
        const partialKey = `${data.privateKey.substring(0, 5)}...${data.privateKey.substring(data.privateKey.length - 5)}`;
        document.getElementById('latestPrivateKey').textContent = partialKey;
        
        document.getElementById('latestAddress').innerHTML = `<a href="https://etherscan.io/address/${data.address}" target="_blank">${data.address}</a>`;

    } else if (data.metrics) {
        document.getElementById('freeMemory').textContent = `${(data.metrics.freeMemory / (1024 * 1024)).toFixed(2)} MB`;
        document.getElementById('totalMemory').textContent = `${(data.metrics.totalMemory / (1024 * 1024)).toFixed(2)} MB`;
        document.getElementById('cpuLoad').textContent = data.metrics.cpuLoad.toFixed(2);
        document.getElementById('attempts').textContent = data.attempts;
    }

    if (data.hasOwnProperty("running")) {
        if (data.running) {
            loop();  // If the hash generator starts, start the maze
        } else {
            noLoop();  // If the hash generator stops, stop the maze
        }
    }
    

    if (data.attempts) {  // Assuming attempts indicate a new hash
        // Reset the timeout every time hash data is received
        clearTimeout(hashDataTimeout);
        noloop();  // Ensure the maze is running
    setup();
        hashDataTimeout = setTimeout(() => {
            Loop();  // Pause the maze if no hash data after the interval
        }, HASH_DATA_INTERVAL);
    }
    
    if (data.failure) {
        noLoop();  // Pause the maze
        setTimeout(() => {
            loop();  // Restart the maze after a timeout
        }, 5000); // You can adjust this timeout if needed, but it should reflect the rate at which the hash generator sends failure messages
    }
    
    if (data.privateKey) {
        latestPrivateKey = data.privateKey;
    }
    
    
};

ws.onopen = () => {
    console.log('WebSocket connected');
};

ws.onclose = () => {
    console.log('WebSocket disconnected');
    noLoop();  // This stops the draw loop in p5.js
    setup();  // This resets the maze
};

function setup() {
    createCanvas(600, 500);
    w = 30;  // Increased cell size
    cols = floor(width / w);
    rows = floor(height / w);
    maze = new Array(cols * rows);
    currentColor = color(0, 0, 0);  // Black color
    targetColor = currentColor;

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            let cell = new Cell(i, j);
            maze[i + j * cols] = cell;
        }
    }

    current = maze[0];
}

function draw() {
    currentColor = lerpColor(currentColor, targetColor, .05);

    // Now, set the gradient background
    for(let i = 0; i <= height; i++){
        let inter = map(i, 0, height, 0, 1);
        let c = lerpColor(currentColor, color(255), inter); // blending currentColor with white for the gradient effect
        stroke(c);
        line(0, i, width, i);
    }
    for (let i = 0; i < maze.length; i++) {
        maze[i].show();
    }

    current.visited = true;
    current.highlight();

    let next = current.checkNeighbors();
    if (next) {
        next.visited = true;
        stack.push(current);
        removeWalls(current, next);
        current = next;
    } else if (stack.length > 0) {
        current = stack.pop();
    }
    if (allCellsVisited()) {
        setup();  // reset the maze
    }
}

function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) {
        a.walls[3] = false;
        b.walls[1] = false;
    } else if (x === -1) {
        a.walls[1] = false;
        b.walls[3] = false;
    }
    let y = a.j - b.j;
    if (y === 1) {
        a.walls[0] = false;
        b.walls[2] = false;
    } else if (y === -1) {
        a.walls[2] = false;
        b.walls[0] = false;
    }
}

function Cell(i, j) {
    this.i = i;
    this.j = j;
    this.walls = [true, true, true, true]; // Top, right, bottom, left
    this.visited = false;

    this.highlight = function() {
        let x = this.i * w;
        let y = this.j * w;
        fill(255, 0, 0); // Color for the key icon
        beginShape();
        vertex(x + w * 0.5, y + w * 0.3);
        vertex(x + w * 0.5, y + w * 0.7);
        vertex(x + w * 0.6, y + w * 0.7);
        endShape();

        fill(0);
        // textFont(myFont);  // Uncomment if you've loaded a custom font
        textSize(16);
        text(`Key: ${latestPrivateKey}`, x, y - 10);
    };

    
    this.show = function() {
        let x = this.i * w;
        let y = this.j * w;
        let offX = random(-1, 1);  // Offset for the hand-drawn effect
        let offY = random(-1, 1);
        stroke(lerpColor(color(100, 100, 100), currentColor, (x+y)/(width+height)));
        strokeWeight(2);  // Making walls thicker
        if (this.walls[0]) line(x + offX, y + offY, x + w + offX, y + offY);
        if (this.walls[1]) line(x + w + offX, y + offY, x + w + offX, y + w + offY);
        if (this.walls[2]) line(x + w + offX, y + w + offY, x + offX, y + w + offY);
        if (this.walls[3]) line(x + offX, y + w + offY, x + offX, y + offY);
    }
    

    this.checkNeighbors = function() {
        let neighbors = [];
        let top = maze[index(i, j - 1)];
        let right = maze[index(i + 1, j)];
        let bottom = maze[index(i, j + 1)];
        let left = maze[index(i - 1, j)];

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        if (neighbors.length > 0) {
            let r = floor(random(0, neighbors.length));
            return neighbors[r];
        } else {
            return undefined;
        }
    }
}

function allCellsVisited() {
    for (let i = 0; i < maze.length; i++) {
        if (!maze[i].visited) {
            return false;
        }
    }
    return true;
}



function index(i, j) {
    if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
    return i + j * cols;
}
