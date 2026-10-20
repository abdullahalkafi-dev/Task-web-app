import { catchAsync } from "../../utils/catchAsync";
import * as noteService from "./note.service";

export const listNotes = catchAsync(async (req, res) => {
  const notes = await noteService.listNotes(req.user.id);
  res.json({ notes });
});
