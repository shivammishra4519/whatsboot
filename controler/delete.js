const fs = require('fs/promises');
const path = require('path');

const deleteFolder = async () => {
    try {
        // Define the path to the '9335792497' folder
        const folderPath = path.join(__dirname, 'sessions', '9198899433');

        // Remove the folder and its contents
        await fs.rm(folderPath, { recursive: true, force: true }, (error) => {
            //you can handle the error here
            console.log(error)
        });

        console.log(`Folder deleted successfully: ${folderPath}`);
    } catch (error) {
        console.error(`Error deleting folder: ${error.message}`);
    }
};

// Execute the function to delete the folder
deleteFolder();
