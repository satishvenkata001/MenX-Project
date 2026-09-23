import { SuggestionService } from '../services/suggestion.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export const createSuggestionHandler = async (req, res, next) => {
  try {
    const userId = req.profile?.id || null;
    const { message } = req.body;

    const result = await SuggestionService.createSuggestion(userId, { message });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result,
      message: 'Thank you for your suggestion! We value your feedback.'
    });
  } catch (err) {
    next(err);
  }
};

export const listSuggestionsAdminHandler = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, search } = req.query;

    const result = await SuggestionService.listSuggestionsAdmin({
      page,
      limit,
      status,
      search
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const updateSuggestionAdminHandler = async (req, res, next) => {
  try {
    const { suggestionId } = req.params;
    const { status, adminNote } = req.body;

    const result = await SuggestionService.updateSuggestionAdmin(suggestionId, {
      status,
      adminNote
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
      message: 'Suggestion updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};
