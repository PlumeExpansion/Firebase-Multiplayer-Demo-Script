import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import { 
    getDatabase, ref, set, update, remove, onDisconnect, onValue, onChildAdded, onChildRemoved
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'

const firebaseConfig = {
    apiKey: "AIzaSyDM4pPlxQfCWdiR5jrkBYsKgEyEwMkKe2g",
    authDomain: "fir-multiplayer-demo-7fb8a.firebaseapp.com",
    databaseURL: "https://fir-multiplayer-demo-7fb8a-default-rtdb.firebaseio.com",
    projectId: "fir-multiplayer-demo-7fb8a",
    storageBucket: "fir-multiplayer-demo-7fb8a.appspot.com",
    messagingSenderId: "965862081297",
    appId: "1:965862081297:web:f3265cca6b86c289e302b0"
}

const app = initializeApp(firebaseConfig)

let playerId, playerRef
let players = {}, coins = {}
let playerElements = {}, coinElements = {}

const gameContainer = document.querySelector(".game-container")
const playerNameInput = document.querySelector("#player-name")
const playerColorButton = document.querySelector("#player-color")

function placeCoin() {
    const {x, y} = getSafeSpot()
    const coinRef = ref(db, `coins/${getKeyString(x,y)}`)
    set(coinRef, {x,y})
    setTimeout(() => {
        placeCoin()
    }, getTimeout())
}

function attemptGrabCoin(x, y) {
    const key = getKeyString(x, y)
    if (coins[key]) {
        remove(ref(db, `coins/${key}`))
        update(playerRef, {
            coins: players[playerId].coins + 1
        })
    }
}

function handleKeyPress(xChange=0, yChange=0) {
    const newX = players[playerId].x + xChange
    const newY = players[playerId].y + yChange
    if (!isSolid(newX, newY)) {
        players[playerId].x = newX
        players[playerId].y = newY
        if (xChange === 1) players[playerId].direction = "right"
        if (xChange === -1) players[playerId].direction = "left"
        set(playerRef, players[playerId])
        attemptGrabCoin(newX, newY)
    }
}

function initGame() {

    new KeyPressListener("ArrowUp", () => handleKeyPress(0, -1))
    new KeyPressListener("ArrowLeft", () => handleKeyPress(-1, 0))
    new KeyPressListener("ArrowDown", () => handleKeyPress(0, 1))
    new KeyPressListener("ArrowRight", () => handleKeyPress(1, 0))

    const allPlayersRef = ref(db, 'players')
    const allCoinsRef = ref(db, `coins`)

    onValue(allPlayersRef, snapshot => {
        players = snapshot.val() || {}
        Object.keys(players).forEach(key => {
            const characterState = players[key]
            let characterElement = playerElements[key]
            characterElement.querySelector(".Character_name").innerText = characterState.name
            characterElement.querySelector(".Character_coins").innerText = characterState.coins
            characterElement.setAttribute("data-color", characterState.color)
            characterElement.setAttribute("data-direction", characterState.direction)
            const left = 16 * characterState.x + "px"
            const top = 16 * characterState.y - 4 + "px"
            characterElement.style.transform = `translate3d(${left}, ${top}, 0)`
        })
    })
    onChildAdded(allPlayersRef, snapshot => {
        const addedPlayer = snapshot.val()
        const characterElement = document.createElement("div")
        characterElement.classList.add("Character", "grid-cell")
        if (addedPlayer.id === playerId) {
            characterElement.classList.add("you")
        }
        characterElement.innerHTML = (`
            <div class="Character_shadow grid-cell"></div>
            <div class="Character_sprite grid-cell"></div>
            <div class="Character_name-container">
                <span class="Character_name"></span>
                <span class="Character_coins">0</span>
            </div>
            <div class="Character_you-arrow"></div>
        `)
        playerElements[addedPlayer.id] = characterElement
        characterElement.querySelector(".Character_name").innerText = addedPlayer.name
        characterElement.querySelector(".Character_coins").innerText = addedPlayer.coins
        characterElement.setAttribute("data-color", addedPlayer.color)
        characterElement.setAttribute("data-direction", addedPlayer.direction)
        const left = 16 * addedPlayer.x + "px"
        const top = 16 * addedPlayer.y - 4 + "px"
        characterElement.style.transform = `translate3d(${left}, ${top}, 0)`
        gameContainer.appendChild(characterElement)
    })
    onChildAdded(allCoinsRef, snapshot => {
        const coin = snapshot.val()
        const key = getKeyString(coin.x, coin.y)
        coins[key] = true
        const coinElement = document.createElement("div")
        coinElement.classList.add("Coin", "grid-cell")
        coinElement.innerHTML = (`
            <div class="Coin_shadow grid-cell"></div>
            <div class="Coin_sprite grid-cell"></div>
        `)
        coinElements[key] = coinElement
        const left = 16 * coin.x + "px"
        const top = 16 * coin.y - 4 + "px"
        coinElement.style.transform = `translate3d(${left}, ${top}, 0)`
        gameContainer.appendChild(coinElement)
    })
    onChildRemoved(allPlayersRef, snapshot => {
        const removedKey = snapshot.val().id
        gameContainer.removeChild(playerElements[removedKey])
        delete playerElements[removedKey]
    })
    onChildRemoved(allCoinsRef, snapshot => {
        const {x, y} = snapshot.val()
        const keyToRemove = getKeyString(x, y)
        gameContainer.removeChild(coinElements[keyToRemove])
        delete coinElements[keyToRemove]
    })
    playerNameInput.addEventListener("change", e => {
        const newName = e.target.value || getName()
        playerNameInput.value = newName
        update(playerRef, {
            name: newName
        })
    })
    playerColorButton.addEventListener("click", () => {
        update(playerRef, {
            color: nextColor(players[playerId].color)
        })
    })

    placeCoin()
}

const auth = getAuth()
const db = getDatabase(app)
signInAnonymously(auth)
    .then(() => {
        console.log("Signed in")
    })
    .catch(err => {
        console.log(err.code, err.message)
    })
onAuthStateChanged(auth, user => {
    console.log(user)
    if (user) {
        console.log("User authenticated")
        playerId = user.uid
        playerRef = ref(db, `players/${playerId}`)
        const name = getName()
        playerNameInput.value = name
        const {x, y} = getSafeSpot()
        
        set(playerRef, {
            id: playerId,
            name,
            direction: "right",
            color: getColor(),
            x,
            y,
            coins: 0
        })

        onDisconnect(playerRef).remove()

        initGame();
    } else {
        console.log("User authentication failed")
    }
})
