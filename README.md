# Hand Tracking with Sakura Blossoms 🌸

*This project was created as part of the university course "Vibe Coding".*

## Description
This web application utilizes your device's webcam to recognize and track hands in real-time, operating entirely within a **Next.js** environment fueled by the **MediaPipe** library. It features a creative and dynamic visual overlay:

- **Sakura Branches:** The standard hand tracking mesh has been artistically modified so that your hand's structure resembles a delicate web of brown branches.
- **Falling Blossoms:** Instead of traditional red landmarks, each joint is represented by a small sakura flower. As you move your hands, interactive sakura petals fall from your fingertips.
- **Dynamic Colors:** The falling blossom petals vividly alternate their shade of pink depending on how high and low you move your hands in the frame.
- **Floor Accumulation:** A custom physics simulation system tracks where each petal lands, piling them up smoothly at the bottom of the screen.
- **Clearing Sequence:** Once the accumulated pile of petals safely reaches halfway up the screen window, a visually pleasing drop-sequence occurs alongside continuous hand-tracking, clearing the space for a fresh cycle!

## Quick Start
1. Ensure you have installed the project's dependencies via `npm install`
2. Start the local server with `npm run dev`
3. Navigate to [http://localhost:3000](http://localhost:3000)
4. Allow browser camera permissions and watch the magic happen!
