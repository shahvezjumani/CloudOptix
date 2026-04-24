import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import * as folderService from "../services/folder.service.js";

const router = Router();
router.use(authenticate);

// List contents of a folder (null folderId = root)
router.get("/", async (req, res, next) => {
  try {
    const folderId = req.query.folderId || null;
    const contents = await folderService.listFolderContents(
      req.user.id,
      folderId,
    );
    res.json(contents);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, parentId } = req.body;
    if (!name)
      return res.status(400).json({ error: "Folder name is required" });
    const folder = await folderService.createFolder(
      name,
      req.user.id,
      parentId,
    );
    res.status(201).json({ folder });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/rename", async (req, res, next) => {
  try {
    const folder = await folderService.renameFolder(
      req.params.id,
      req.user.id,
      req.body.name,
    );
    res.json({ folder });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await folderService.deleteFolder(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Move a file into a folder
router.patch("/:folderId/move/:fileId", async (req, res, next) => {
  try {
    const file = await folderService.moveFile(
      req.params.fileId,
      req.params.folderId,
      req.user.id,
    );
    res.json({ file });
  } catch (err) {
    next(err);
  }
});

export default router;
