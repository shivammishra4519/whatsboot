const { getDB } = require('../dbConnection');

async function checkForExpiredPlans() {
  try {
    const db = getDB(); // Replace with your DB name
    const usersCollection = db.collection('soldPlans'); // Replace with the collection storing user plans
    const expiredPlansCollection = db.collection('expiredplans');

    const currentTime = new Date();

    // Fetch all users
    const users = await usersCollection.find({}).toArray();

    for (const user of users) {
      const activePlans = user.plans.filter(plan => {
        let planTimestamp;

        // Check if the timestamp is in the correct format
        if (plan.timestamp.$date) {
          planTimestamp = new Date(plan.timestamp.$date); // Correct format for MongoDB $date field
        } else {
          planTimestamp = new Date(plan.timestamp); // Handle other possible formats
        }

        const expirationTime = new Date(planTimestamp);
        expirationTime.setDate(expirationTime.getDate() + plan.plan.duration);

        // If current time is less than expiration time, the plan is still active
        return currentTime < expirationTime;
      });

      const expiredPlans = user.plans.filter(plan => {
        let planTimestamp;

        // Check if the timestamp is in the correct format
        if (plan.timestamp.$date) {
          planTimestamp = new Date(plan.timestamp.$date); // Correct format for MongoDB $date field
        } else {
          planTimestamp = new Date(plan.timestamp); // Handle other possible formats
        }

        const expirationTime = new Date(planTimestamp);
        expirationTime.setDate(expirationTime.getDate() + plan.plan.duration);

        // console.log('Expiration time:', expirationTime);

        // If current time is greater than expiration time, the plan is expired
        return currentTime >= expirationTime;
      });

      // If there are expired plans, remove them from the user and insert into expiredPlansCollection
      if (expiredPlans.length > 0) {
        // Update the user's active plans in the soldPlans collection
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { plans: activePlans } }
        );

        // Check if the user already exists in the expiredPlansCollection
        const existingExpiredUser = await expiredPlansCollection.findOne({ username: user.username });

        if (existingExpiredUser) {
          // User already exists, so append the expired plans to the existing array
          await expiredPlansCollection.updateOne(
            { username: user.username },
            { $push: { plans: { $each: expiredPlans } } }
          );
        //   console.log(`Updated expired plans for user ${user.username}`);
        } else {
          // User doesn't exist, insert a new document with the expired plans
          await expiredPlansCollection.insertOne({
            username: user.username,
            plans: expiredPlans
          });
          console.log(`Moved expired plans for user ${user.username}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking for expired plans:', error);
  }
}

// Run the check every second
setInterval(checkForExpiredPlans, 1000);
